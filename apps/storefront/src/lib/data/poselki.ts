"use server"

import "server-only"

import { updateCheckoutFields } from "./cart"
import данные from "./punkty-vydachi.json"

/**
 * Посёлки, сёла и деревни для поля «Город доставки».
 *
 * Наш список городов (cities.json) — только те, где есть пункты выдачи.
 * Человек из Вешек ищет «Вешки» и не находит, хотя пункты выдачи в
 * сотне метров — за чертой Москвы. Поэтому посёлки ищем в DaData (это
 * справочник адресов ФИАС: в нём вся страна, с районами), а при выборе
 * ставим в заказ город ближайшего пункта выдачи.
 *
 * Ближайший — именно пункт, а не центр города: от Вешек до центра Москвы
 * дальше, чем до Мытищ, а пункты выдачи «Москвы» стоят у самой деревни.
 * Координаты пунктов собирает scripts/collect-cities.js.
 *
 * Ключ DaData (DADATA_KEY) — только на сервере. Без ключа или если DaData
 * не отвечает, посёлков просто нет в подсказках, города работают.
 */
type Пункты = {
  goroda: string[]
  /** [широта, долгота, номер города] */
  punkty: [number, number, number][]
}

export type Посёлок = {
  /** fias_id: по нему при выборе заново спрашиваем DaData, браузеру не верим */
  id: string
  имя: string
  /** «Мытищинский р-н, Московская обл» */
  где: string
}

export type ВыбранПосёлок =
  | { имя: string; город: string; км: number }
  | { имя: string; город: null; ошибка: string }

const { goroda, punkty } = данные as Пункты

const DADATA = "https://suggestions.dadata.ru/suggestions/api/4_1/rs"
// Дальше этого пункт выдачи уже не «рядом»: не предлагаем
const ДАЛЬШЕ_НЕ_ВОЗИМ_КМ = 60

const обычный = (с: string) => с.trim().toLowerCase().replace(/ё/g, "е")

const НАШИ = new Set(goroda.map(обычный))

const dadata = async (путь: string, тело: object) => {
  const ключ = process.env.DADATA_KEY
  if (!ключ) {
    return null
  }
  const ответ = await fetch(`${DADATA}/${путь}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Token ${ключ}`,
    },
    body: JSON.stringify(тело),
    cache: "no-store",
    signal: AbortSignal.timeout(3000),
  })
  if (!ответ.ok) {
    throw new Error(`DaData ответила ${ответ.status}`)
  }
  return ((await ответ.json()).suggestions ?? []) as {
    value: string
    data: Record<string, string | null>
  }[]
}

const имяИз = (д: Record<string, string | null>) =>
  (д.settlement ?? д.city ?? "").trim()

export const найтиПосёлки = async (запрос: string): Promise<Посёлок[]> => {
  if (обычный(запрос).length < 2) {
    return []
  }
  try {
    const найдено = await dadata("suggest/address", {
      query: запрос,
      count: 8,
      from_bound: { value: "city" },
      to_bound: { value: "settlement" },
      locations: [{ country_iso_code: "RU" }],
    })

    return (найдено ?? [])
      .filter(({ data: д }) => {
        const имя = имяИз(д)
        // Город из нашего списка уже есть в подсказках выше — без дубля
        return имя && д.fias_id && !(!д.settlement && НАШИ.has(обычный(имя)))
      })
      .slice(0, 5)
      .map(({ data: д }) => ({
        id: д.fias_id!,
        имя: имяИз(д),
        // Тип нужен: под Мытищами есть и деревня Вешки, и посёлок Вешки
        где: [
          д.settlement ? д.settlement_type_full : д.city_type_full,
          д.settlement ? д.area_with_type ?? д.city_with_type : д.area_with_type,
          д.region_with_type,
        ]
          .filter((ч, и, все): ч is string => !!ч && все.indexOf(ч) === и)
          .join(", "),
      }))
  } catch {
    return []
  }
}

const км = (ш1: number, д1: number, ш2: number, д2: number) => {
  const р = Math.PI / 180
  const h =
    Math.sin(((ш2 - ш1) * р) / 2) ** 2 +
    Math.cos(ш1 * р) * Math.cos(ш2 * р) * Math.sin(((д2 - д1) * р) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

const ближайшийГород = (ш: number, д: number) => {
  let лучший = -1
  let расст = ДАЛЬШЕ_НЕ_ВОЗИМ_КМ
  for (const [пш, пд, город] of punkty) {
    // Грубый отсев по градусу — без синусов для дальних пунктов
    if (Math.abs(пш - ш) > 1 || Math.abs(пд - д) > 2) {
      continue
    }
    const р = км(ш, д, пш, пд)
    if (р < расст) {
      лучший = город
      расст = р
    }
  }
  return лучший < 0 ? null : { город: goroda[лучший], км: расст }
}

/**
 * Посёлок выбран: находим город ближайшего пункта выдачи и пишем его в
 * корзину, а сам посёлок — в заметки корзины (виден в заказе в админке).
 */
export const выбратьПосёлок = async (id: string): Promise<ВыбранПосёлок> => {
  const [найден] = (await dadata("findById/address", { query: id }).catch(() => null)) ?? []
  if (!найден) {
    return { имя: "", город: null, ошибка: "Не получилось найти посёлок, попробуйте ещё раз" }
  }

  const д = найден.data
  const имя = имяИз(д)
  const ш = Number(д.geo_lat)
  const дол = Number(д.geo_lon)
  const рядом = ш && дол ? ближайшийГород(ш, дол) : null

  if (!рядом) {
    return { имя, город: null, ошибка: `Рядом с «${имя}» пока нет пунктов выдачи` }
  }

  await updateCheckoutFields({
    адрес: { city: рядом.город, country_code: "ru" },
    заметки: { poselok: имя, poselok_adres: найден.value },
  })

  return { имя, город: рядом.город, км: Math.max(1, Math.round(рядом.км)) }
}
