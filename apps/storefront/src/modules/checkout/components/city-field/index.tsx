"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { updateCheckoutFields } from "@lib/data/cart"
import города from "@lib/data/cities.json"
import {
  найтиПосёлки,
  выбратьПосёлок,
  type Посёлок,
} from "@lib/data/poselki"
import { HttpTypes } from "@medusajs/types"
import Input from "@modules/common/components/input"

import { useОтметка } from "../steps/context"

/**
 * Город доставки — первый пункт оформления.
 *
 * Заменил собой блок с полным адресом: проверка показала, что службе
 * достаточно города — цена с одним городом, с индексом и с улицей
 * совпадает до копейки, и телефон для расчёта тоже не нужен. Поэтому
 * город стоит выше доставки, а контакты спрашиваются уже после того, как
 * человек увидел цены.
 *
 * Подсказки берутся из списка, собранного из самих пунктов выдачи
 * (scripts/collect-cities.js): это города, куда действительно возят, а не
 * все населённые пункты страны. Список лежит рядом файлом, поэтому
 * подсказки появляются мгновенно и не зависят от чужого сервиса.
 *
 * Город принимаем только из этого списка. Город не из списка службы не
 * узнают, и следующий пункт оказался бы пустым — с непонятной причиной.
 * Лучше сказать об этом сразу и своими словами.
 *
 * Посёлки и деревни ищем отдельно, в DaData (lib/data/poselki): в поле
 * остаётся посёлок, а в заказ уходит город ближайшего к нему пункта
 * выдачи — под полем пояснение, какой.
 */
type Город = [string] | [string, string]

const СПИСОК = города as Город[]
const СКОЛЬКО_ПОКАЗЫВАТЬ = 8
// Пустое поле: сразу показываем крупные города, список прокручивается
const СКОЛЬКО_ПОПУЛЯРНЫХ = 20

// «Орёл» и «Орел» — одно и то же: на телефоне «ё» почти никто не ищет
const обычный = (с: string) => с.trim().toLowerCase().replace(/ё/g, "е")

const ПО_ИМЕНИ = new Map(СПИСОК.map(([имя]) => [обычный(имя), имя]))

// Выбранный посёлок и город, куда по нему считаем доставку
type ВПоле = { имя: string; город: string; км: number | null }

const CityField = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  const прежнийПосёлок = (cart?.metadata?.poselok as string) || ""
  const прежнийГород = cart?.shipping_address?.city ?? ""
  const [город, setГород] = useState(прежнийПосёлок || прежнийГород)
  const [открыт, setОткрыт] = useState(false)
  const [трогали, setТрогали] = useState(false)
  const [сбой, setСбой] = useState<string | null>(null)
  // Ищем ли по тексту в поле. Нет — когда поле пустое или в нём уже
  // выбранный город: тогда показываем крупные города.
  const [ищем, setИщем] = useState(false)
  const [посёлки, setПосёлки] = useState<Посёлок[]>([])
  const [посёлок, setПосёлок] = useState<ВПоле | null>(
    прежнийПосёлок && прежнийГород
      ? { имя: прежнийПосёлок, город: прежнийГород, км: null }
      : null
  )
  const [нетРядом, setНетРядом] = useState<string | null>(null)
  const прошлый = useRef(прежнийПосёлок ? "" : прежнийГород)
  const отметить = useОтметка()

  const чистый = город.trim()
  const подходит =
    ПО_ИМЕНИ.has(обычный(чистый)) || (!!посёлок && чистый === посёлок.имя)

  // Пока не подходит — следующий пункт остаётся закрытым.
  useEffect(() => {
    отметить("город", подходит && !сбой)
  }, [подходит, сбой, отметить])

  const ошибка = сбой
    ? `Не удалось сохранить город: ${сбой}`
    : нетРядом
      ? нетРядом
      : !трогали || подходит
      ? null
      : !чистый
        ? "Укажите город или посёлок — без него не посчитать доставку"
        : "Выберите город или посёлок из подсказок"

  const запрос = ищем ? обычный(город) : ""

  const подсказки = useMemo(() => {
    if (!запрос) {
      return СПИСОК.slice(0, СКОЛЬКО_ПОПУЛЯРНЫХ)
    }

    // Сначала те, что начинаются с введённого, потом те, где оно внутри:
    // человек чаще набирает начало названия.
    const начинаются: Город[] = []
    const содержат: Город[] = []

    for (const запись of СПИСОК) {
      const имя = обычный(запись[0])
      if (имя.startsWith(запрос)) {
        начинаются.push(запись)
      } else if (имя.includes(запрос)) {
        содержат.push(запись)
      }
      if (начинаются.length >= СКОЛЬКО_ПОКАЗЫВАТЬ) {
        break
      }
    }

    return [...начинаются, ...содержат].slice(0, СКОЛЬКО_ПОКАЗЫВАТЬ)
  }, [запрос])

  // Посёлки — с сервера, с короткой паузой после ввода, чтобы не
  // спрашивать на каждую букву. Ответ на устаревший запрос отбрасываем.
  useEffect(() => {
    if (запрос.length < 2) {
      setПосёлки([])
      return
    }
    let актуален = true
    const таймер = window.setTimeout(() => {
      найтиПосёлки(запрос)
        .then((найдено) => актуален && setПосёлки(найдено))
        .catch(() => актуален && setПосёлки([]))
    }, 250)
    return () => {
      актуален = false
      window.clearTimeout(таймер)
    }
  }, [запрос])

  const сохранить = async (значение: string) => {
    // Город пишем так, как он записан в списке: «орел» → «Орёл»
    const чистое = ПО_ИМЕНИ.get(обычный(значение))
    // Незнакомый город в заказ не пишем: следующий пункт всё равно не
    // откроется, а в корзине осталась бы мусорная строка.
    if (!чистое || чистое === прошлый.current) {
      return
    }
    прошлый.current = чистое

    try {
      setСбой(null)
      // Выбран город — прежний посёлок из заметок корзины стираем
      await updateCheckoutFields({
        адрес: { city: чистое, country_code: "ru" },
        заметки: { poselok: "", poselok_adres: "" },
      })
    } catch (e) {
      прошлый.current = ""
      setСбой((e as Error).message)
    }
  }

  const выбрать = (имя: string) => {
    setГород(имя)
    setПосёлок(null)
    setНетРядом(null)
    setИщем(false)
    setОткрыт(false)
    setТрогали(true)
    сохранить(имя)
  }

  // Город посёлку подбирает сервер — по ближайшему пункту выдачи — и сам
  // пишет его в корзину. Пока ждём ответа, в поле уже стоит посёлок.
  const выбратьИзДаДаты = async (п: Посёлок) => {
    setГород(п.имя)
    setПосёлок(null)
    setНетРядом(null)
    setИщем(false)
    setОткрыт(false)
    setТрогали(true)
    try {
      setСбой(null)
      const итог = await выбратьПосёлок(п.id)
      if ("ошибка" in итог) {
        setНетРядом(итог.ошибка)
      } else {
        прошлый.current = ""
        setПосёлок({ имя: п.имя, город: итог.город, км: итог.км })
      }
    } catch (e) {
      setСбой((e as Error).message)
    }
  }

  // Галочка появляется, как только город узнан: без неё непонятно,
  // приняла форма введённое или нет — человек дописывал название и не
  // понимал, почему следующий пункт всё ещё закрыт.
  const узнан = подходит && !сбой

  return (
    <div className="relative max-w-sm">
      <Input
        label="Город доставки"
        name="shipping_address.city"
        autoComplete="off"
        value={город}
        onChange={(e) => {
          setГород(e.target.value)
          setПосёлок(null)
          setНетРядом(null)
          setИщем(true)
          setОткрыт(true)
        }}
        onFocus={(e) => {
          // Выделяем прежний город: начал печатать — он заменился сам,
          // стирать по букве не нужно. Недописанное название не трогаем —
          // подсказки к нему и показываем.
          if (подходит) {
            e.target.select()
          }
          setИщем(!подходит && !!чистый && !нетРядом)
          setОткрыт(true)
        }}
        // Закрываем с задержкой: без неё список исчезает раньше, чем
        // успевает сработать нажатие на подсказку.
        onBlur={() => {
          window.setTimeout(() => setОткрыт(false), 150)
          setТрогали(true)
          if (посёлок || нетРядом) {
            return
          }
          const точный = ПО_ИМЕНИ.get(обычный(город))
          if (точный && точный !== город) {
            setГород(точный)
          }
          сохранить(город)
        }}
        обязательно
        ошибка={ошибка}
        data-testid="delivery-city-input"
      />

      {узнан && (
        <span
          // Поле высотой 44 px, значок прижат к правому краю внутри него
          className="pointer-events-none absolute right-3 top-[14px] text-ink"
          data-testid="gorod-prinyat"
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="m5 12.5 4.5 4.5L19 7" />
          </svg>
        </span>
      )}

      {посёлок && !открыт && (
        <p className="mt-2 text-sm text-muted" data-testid="gorod-poselka">
          Пункты выдачи — в городе {посёлок.город}
          {посёлок.км !== null && `, ближайший примерно в ${посёлок.км} км`}
        </p>
      )}

      {открыт && (подсказки.length > 0 || посёлки.length > 0) && (
        <ul
          className="absolute left-0 right-0 top-[52px] z-20 mt-1 max-h-72 overflow-y-auto border border-rule bg-paper shadow-lg"
          data-testid="city-suggestions"
        >
          {подсказки.map(([имя, регион]) => (
            <li key={имя}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => выбрать(имя)}
                className="flex w-full items-baseline gap-x-2 px-4 py-3 text-left text-sm hover:bg-mist"
              >
                <span className="text-ink">{имя}</span>
                {регион && <span className="text-muted">{регион}</span>}
              </button>
            </li>
          ))}

          {посёлки.map((п) => (
            <li key={п.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => выбратьИзДаДаты(п)}
                className="flex w-full flex-wrap items-baseline gap-x-2 px-4 py-3 text-left text-sm hover:bg-mist"
                data-testid="poselok-podskazka"
              >
                <span className="text-ink">{п.имя}</span>
                {п.где && <span className="text-muted">{п.где}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default CityField
