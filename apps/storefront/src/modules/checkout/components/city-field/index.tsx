"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { updateCheckoutFields } from "@lib/data/cart"
import города from "@lib/data/cities.json"
import {
  найтиНаселённыйПункт,
  type НаселённыйПункт,
} from "@lib/data/naselennye-punkty"
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
 * Посёлки и деревни ищем отдельно, на сервере (naselennye-punkty): при
 * выборе посёлка в поле встаёт ближайший к нему город с пунктами выдачи,
 * а под полем — пояснение, почему город другой.
 */
type Город = [string] | [string, string]

const СПИСОК = города as Город[]
const СКОЛЬКО_ПОКАЗЫВАТЬ = 8
// Пустое поле: сразу показываем крупные города, список прокручивается
const СКОЛЬКО_ПОПУЛЯРНЫХ = 20

// «Орёл» и «Орел» — одно и то же: на телефоне «ё» почти никто не ищет
const обычный = (с: string) => с.trim().toLowerCase().replace(/ё/g, "е")

const ПО_ИМЕНИ = new Map(СПИСОК.map(([имя]) => [обычный(имя), имя]))

const CityField = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  const [город, setГород] = useState(cart?.shipping_address?.city ?? "")
  const [открыт, setОткрыт] = useState(false)
  const [трогали, setТрогали] = useState(false)
  const [сбой, setСбой] = useState<string | null>(null)
  // Ищем ли по тексту в поле. Нет — когда поле пустое или в нём уже
  // выбранный город: тогда показываем крупные города.
  const [ищем, setИщем] = useState(false)
  const [посёлки, setПосёлки] = useState<НаселённыйПункт[]>([])
  const [посёлок, setПосёлок] = useState<НаселённыйПункт | null>(null)
  const прошлый = useRef(cart?.shipping_address?.city ?? "")
  const отметить = useОтметка()

  const чистый = город.trim()
  const подходит = ПО_ИМЕНИ.has(обычный(чистый))

  // Пока не подходит — следующий пункт остаётся закрытым.
  useEffect(() => {
    отметить("город", подходит && !сбой)
  }, [подходит, сбой, отметить])

  const ошибка = сбой
    ? `Не удалось сохранить город: ${сбой}`
    : !трогали || подходит
      ? null
      : !чистый
        ? "Укажите город — без него не посчитать доставку"
        : "Выберите город из подсказок: в другие мы пока не возим"

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
      найтиНаселённыйПункт(запрос)
        .then((найдено) => актуален && setПосёлки(найдено))
        .catch(() => актуален && setПосёлки([]))
    }, 200)
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
      await updateCheckoutFields({ адрес: { city: чистое, country_code: "ru" } })
    } catch (e) {
      прошлый.current = ""
      setСбой((e as Error).message)
    }
  }

  const выбрать = (имя: string, откуда: НаселённыйПункт | null = null) => {
    setГород(имя)
    setПосёлок(откуда)
    setИщем(false)
    setОткрыт(false)
    setТрогали(true)
    сохранить(имя)
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
          setИщем(!подходит && !!чистый)
          setОткрыт(true)
        }}
        // Закрываем с задержкой: без неё список исчезает раньше, чем
        // успевает сработать нажатие на подсказку.
        onBlur={() => {
          window.setTimeout(() => setОткрыт(false), 150)
          setТрогали(true)
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
          {посёлок.имя}: ближайший город с пунктами выдачи — {посёлок.город}
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
            <li key={`${п.имя}|${п.регион}|${п.город}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => выбрать(п.город, п)}
                className="block w-full px-4 py-3 text-left text-sm hover:bg-mist"
                data-testid="poselok-podskazka"
              >
                <span className="flex items-baseline gap-x-2">
                  <span className="text-ink">{п.имя}</span>
                  <span className="text-muted">{п.регион}</span>
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  Доставим в ближайший город — {п.город}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default CityField
