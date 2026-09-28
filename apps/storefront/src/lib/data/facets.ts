"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"

import { getAuthHeaders, getCacheOptions } from "./cookies"

/**
 * Признаки для фильтра каталога: сезон, покрой, цвет, новинки.
 *
 * Считаются по лёгкой выписке всего каталога — без региона, а значит без
 * цен. Это принципиально: те же 394 товара с ценами весят 3,6 МБ и
 * считаются 2,6 секунды, а без них — 252 КБ и 0,15 секунды.
 *
 * Дальше отбор идёт у нас: пересекаем списки товаров по каждому
 * выбранному признаку и отдаём готовые id. У Medusa условия по разделу
 * и по списку id складываются по И, так что фильтр работает и внутри
 * раздела.
 */

// Метка, которой в админке помечают новинки. Без export: в файле с
// "use server" наружу можно отдавать только асинхронные функции.
const МЕТКА_НОВИНКИ = "новинка"

export type Признак = {
  значение: string
  сколько: number
  /** только у цвета: код для кружка */
  код?: string
  /** если значение техническое (адрес раздела) — что показать человеку */
  подпись?: string
}

export type Признаки = {
  /** пусто, когда человек уже внутри раздела: выбирать там нечего */
  разделы: Признак[]
  сезоны: Признак[]
  покрои: Признак[]
  цвета: Признак[]
  новинок: number
}

export type ВыбранныеФильтры = {
  раздел?: string[]
  сезон?: string[]
  покрой?: string[]
  цвет?: string[]
  новинки?: boolean
}

type Лёгкий = {
  id: string
  created_at?: string
  metadata?: Record<string, unknown> | null
  tags?: { value?: string }[] | null
  categories?: { id?: string; name?: string; handle?: string }[] | null
}

const строка = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : undefined

/** Цвет приходит как «бежевый, темно-бежевый» — берём первый. */
const первыйЦвет = (v: unknown) => строка(v)?.split(",")[0].trim()

const новинка = (p: Лёгкий) =>
  (p.tags ?? []).some(
    (t) => (t.value ?? "").trim().toLowerCase() === МЕТКА_НОВИНКИ
  )

/** Вся выписка каталога: id, дата, метаданные, метки. Без цен. */
const выписка = async (): Promise<Лёгкий[]> => {
  const headers = { ...(await getAuthHeaders()) }
  const next = { ...(await getCacheOptions("products")) }

  try {
    const { products } = await sdk.client.fetch<{ products: Лёгкий[] }>(
      "/store/products",
      {
        method: "GET",
        query: {
          limit: 1000,
          fields:
            "id,created_at,metadata,+tags,+categories.id,+categories.name,+categories.handle",
        },
        headers,
        next,
        cache: "force-cache",
      }
    )
    return products ?? []
  } catch (e) {
    console.error("Не удалось получить выписку каталога для фильтра", e)
    return []
  }
}

/**
 * Сужает выписку до того, что вообще показывается на странице: товары
 * раздела, находки поиска — или и то и другое. Признаки и отбор считаем
 * только по ним, иначе в фильтре стояли бы числа всего магазина.
 */
const своиТовары = (
  все: Лёгкий[],
  идыРаздела?: string[],
  толькоИды?: string[]
): Лёгкий[] => {
  let свои = все

  if (идыРаздела?.length) {
    свои = свои.filter((p) =>
      (p.categories ?? []).some((c) => c.id && идыРаздела.includes(c.id))
    )
  }

  if (толькоИды) {
    const можно = new Set(толькоИды)
    свои = свои.filter((p) => можно.has(p.id))
  }

  return свои
}

/**
 * id товаров, которые нашлись по слову. Нужны, чтобы посчитать фильтр
 * по находкам, а не по всему каталогу: ищем один раз и налегке, без цен.
 */
export const идыПоиска = async (запрос: string): Promise<string[]> => {
  const чистый = запрос.trim()

  if (чистый.length < 2) {
    return []
  }

  const headers = { ...(await getAuthHeaders()) }
  const next = { ...(await getCacheOptions("products")) }

  try {
    const { products } = await sdk.client.fetch<{ products: { id: string }[] }>(
      "/store/products",
      {
        method: "GET",
        query: { limit: 1000, fields: "id", q: чистый },
        headers,
        next,
        cache: "force-cache",
      }
    )
    return (products ?? []).map((p) => p.id)
  } catch (e) {
    console.error("Поиск по каталогу не отработал", e)
    return []
  }
}

/** Что вообще можно выбрать в фильтре и сколько за каждым товаров. */
export const собратьПризнаки = async (
  идыРаздела?: string[],
  толькоИды?: string[]
): Promise<Признаки> => {
  const все = await выписка()
  const свои = своиТовары(все, идыРаздела, толькоИды)

  // Раздел предлагаем выбрать, только когда человек смотрит весь каталог
  // или находки поиска. Внутри «Брюк» такая галочка бессмысленна: он уже
  // в разделе, и выбирать там нечего.
  const разделы = new Map<string, { сколько: number; подпись: string }>()
  const сезоны = new Map<string, number>()
  const покрои = new Map<string, number>()
  const цвета = new Map<string, { сколько: number; код?: string }>()
  let новинок = 0

  for (const p of свои) {
    const m = p.metadata ?? {}
    const s = строка(m.season)
    const c = строка(m.cut)
    const col = первыйЦвет(m.color)

    if (s) сезоны.set(s, (сезоны.get(s) ?? 0) + 1)
    if (c) покрои.set(c, (покрои.get(c) ?? 0) + 1)
    if (col) {
      const было = цвета.get(col)
      цвета.set(col, {
        сколько: (было?.сколько ?? 0) + 1,
        код: было?.код ?? строка(m.color_hex),
      })
    }
    if (новинка(p)) новинок++

    if (!идыРаздела?.length) {
      for (const к of p.categories ?? []) {
        if (!к.handle) continue
        const было = разделы.get(к.handle)
        разделы.set(к.handle, {
          сколько: (было?.сколько ?? 0) + 1,
          подпись: было?.подпись ?? к.name ?? к.handle,
        })
      }
    }
  }

  const вСписок = (m: Map<string, number>): Признак[] =>
    [...m.entries()]
      .map(([значение, сколько]) => ({ значение, сколько }))
      .sort((a, b) => b.сколько - a.сколько || a.значение.localeCompare(b.значение))

  return {
    разделы: [...разделы.entries()]
      .map(([значение, v]) => ({
        значение,
        сколько: v.сколько,
        подпись: v.подпись,
      }))
      .sort((a, b) => b.сколько - a.сколько || a.подпись.localeCompare(b.подпись)),
    сезоны: вСписок(сезоны),
    покрои: вСписок(покрои),
    цвета: [...цвета.entries()]
      .map(([значение, v]) => ({ значение, сколько: v.сколько, код: v.код }))
      .sort((a, b) => b.сколько - a.сколько || a.значение.localeCompare(b.значение)),
    новинок,
  }
}

/**
 * Товары, подходящие под выбранные фильтры.
 *
 * Внутри одного признака — «или» (чёрный или синий), между признаками —
 * «и» (чёрный И прямой). Так фильтры ведут себя в любом магазине.
 *
 * Возвращает null, если не выбрано ничего: значит фильтровать не надо и
 * список id в запрос подставлять не нужно.
 */
export const найтиТовары = async (
  фильтры: ВыбранныеФильтры,
  идыРаздела?: string[],
  толькоИды?: string[]
): Promise<string[] | null> => {
  const естьЧто =
    фильтры.раздел?.length ||
    фильтры.сезон?.length ||
    фильтры.покрой?.length ||
    фильтры.цвет?.length ||
    фильтры.новинки

  // Поиск сам по себе уже сузил каталог: даже без единой галочки нужно
  // вернуть его находки, а не null (он означает «показывай всё»).
  if (!естьЧто && !толькоИды) {
    return null
  }

  const всеТовары = await выписка()
  const все = своиТовары(всеТовары, идыРаздела, толькоИды)

  const подходит = (p: Лёгкий) => {
    const m = p.metadata ?? {}
    if (
      фильтры.раздел?.length &&
      !(p.categories ?? []).some(
        (к) => к.handle && фильтры.раздел!.includes(к.handle)
      )
    ) {
      return false
    }
    if (фильтры.сезон?.length && !фильтры.сезон.includes(строка(m.season) ?? "")) {
      return false
    }
    if (фильтры.покрой?.length && !фильтры.покрой.includes(строка(m.cut) ?? "")) {
      return false
    }
    if (фильтры.цвет?.length && !фильтры.цвет.includes(первыйЦвет(m.color) ?? "")) {
      return false
    }
    if (фильтры.новинки && !новинка(p)) {
      return false
    }
    return true
  }

  // новые сверху: тем же порядком, что и «Новинки» в сортировке
  return все
    .filter(подходит)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .map((p) => p.id)
}

/** Разбирает фильтры из адреса страницы. */
export const прочитатьФильтры = async (
  params: Record<string, string | string[] | undefined>
): Promise<ВыбранныеФильтры> => {
  const список = (v: string | string[] | undefined) =>
    typeof v === "string" ? v.split("~").filter(Boolean) : v

  return {
    раздел: список(params["раздел"]),
    сезон: список(params["сезон"]),
    покрой: список(params["покрой"]),
    цвет: список(params["цвет"]),
    новинки: params["новинки"] === "да",
  }
}

