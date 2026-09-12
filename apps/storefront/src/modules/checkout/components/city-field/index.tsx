"use client"

import { useMemo, useRef, useState } from "react"

import { updateCheckoutFields } from "@lib/data/cart"
import города from "@lib/data/cities.json"
import { HttpTypes } from "@medusajs/types"
import Input from "@modules/common/components/input"

/**
 * Город доставки — первое, что спрашивают на странице.
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
 */
type Город = [string] | [string, string]

const СПИСОК = города as Город[]
const СКОЛЬКО_ПОКАЗЫВАТЬ = 8

const CityField = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  const [город, setГород] = useState(cart?.shipping_address?.city ?? "")
  const [открыт, setОткрыт] = useState(false)
  const [ошибка, setОшибка] = useState<string | null>(null)
  const прошлый = useRef(cart?.shipping_address?.city ?? "")

  const подсказки = useMemo(() => {
    const запрос = город.trim().toLowerCase()
    if (!запрос) {
      return []
    }

    // Сначала те, что начинаются с введённого, потом те, где оно внутри:
    // человек чаще набирает начало названия.
    const начинаются: Город[] = []
    const содержат: Город[] = []

    for (const запись of СПИСОК) {
      const имя = запись[0].toLowerCase()
      if (имя === запрос) {
        continue
      }
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
  }, [город])

  const сохранить = async (значение: string) => {
    const чистое = значение.trim()
    if (!чистое || чистое === прошлый.current) {
      return
    }
    прошлый.current = чистое

    try {
      setОшибка(null)
      await updateCheckoutFields({ адрес: { city: чистое, country_code: "ru" } })
    } catch (e) {
      setОшибка((e as Error).message)
    }
  }

  const выбрать = (имя: string) => {
    setГород(имя)
    setОткрыт(false)
    сохранить(имя)
  }

  return (
    <div className="relative max-w-sm">
      <Input
        label="Город доставки"
        name="shipping_address.city"
        autoComplete="off"
        value={город}
        onChange={(e) => {
          setГород(e.target.value)
          setОткрыт(true)
        }}
        onFocus={() => setОткрыт(true)}
        // Закрываем с задержкой: без неё список исчезает раньше, чем
        // успевает сработать нажатие на подсказку.
        onBlur={() => {
          window.setTimeout(() => setОткрыт(false), 150)
          сохранить(город)
        }}
        required
        data-testid="delivery-city-input"
      />

      {открыт && подсказки.length > 0 && (
        <ul
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto border border-rule bg-paper shadow-lg"
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
        </ul>
      )}

      {ошибка && (
        <p className="mt-2 text-sm text-red-600">Не удалось сохранить: {ошибка}</p>
      )}
    </div>
  )
}

export default CityField
