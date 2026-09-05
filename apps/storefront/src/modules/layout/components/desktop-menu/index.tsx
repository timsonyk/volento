"use client"

import Image from "next/image"
import { useRef, useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Горизонтальное меню в шапке на компьютере, как на референсе: слева ряд
 * разделов, у одного из них раскрывается широкая панель на всю ширину —
 * колонки ссылок и крупный снимок справа.
 *
 * Панель открывается наведением и закрывается с задержкой: без неё курсор,
 * проходя над зазором между кнопкой и панелью, схлопывал бы её на полпути.
 * С клавиатуры работает так же — раскрытие по фокусу.
 *
 * На телефоне меню не показывается, там прежняя выезжающая шторка.
 */
export type Раздел = { имя: string; адрес: string }

export type Колонка = { заголовок: string; ссылки: Раздел[] }

export default function DesktopMenu({
  пункты,
  колонки,
  снимок,
}: {
  пункты: Раздел[]
  колонки: Колонка[]
  снимок?: string
}) {
  const [открыт, setОткрыт] = useState(false)
  const таймер = useRef<ReturnType<typeof setTimeout> | null>(null)

  const открыть = () => {
    if (таймер.current) {
      clearTimeout(таймер.current)
      таймер.current = null
    }
    setОткрыт(true)
  }

  const закрыть = () => {
    таймер.current = setTimeout(() => setОткрыт(false), 120)
  }

  return (
    <div
      className="hidden h-full items-center small:flex"
      onMouseLeave={закрыть}
      onMouseEnter={открыть}
    >
      <nav aria-label="Разделы каталога">
        <ul className="flex items-center gap-x-7">
          <li>
            <button
              type="button"
              aria-expanded={открыт}
              onFocus={открыть}
              onClick={() => setОткрыт((v) => !v)}
              className="text-sm text-ink underline-offset-[6px] transition-opacity hover:opacity-60 aria-expanded:underline"
            >
              Каталог
            </button>
          </li>
          {пункты.map((п) => (
            <li key={п.адрес}>
              <LocalizedClientLink
                href={п.адрес}
                onFocus={закрыть}
                className="text-sm text-ink transition-opacity hover:opacity-60"
              >
                {п.имя}
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* панель во всю ширину окна: она вне потока шапки, поэтому шапка
          не прыгает, когда панель появляется */}
      <div
        className={
          "absolute inset-x-0 top-full border-b border-rule bg-paper transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none " +
          (открыт
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0")
        }
      >
        <div className="content-container grid grid-cols-[repeat(2,minmax(0,1fr))_minmax(0,2fr)] gap-x-10 py-10">
          {колонки.map((к) => (
            <div key={к.заголовок}>
              <p className="mb-6 text-sm text-ink">{к.заголовок}</p>
              <ul className="flex flex-col gap-y-3">
                {к.ссылки.map((с) => (
                  <li key={с.адрес}>
                    <LocalizedClientLink
                      href={с.адрес}
                      onClick={() => setОткрыт(false)}
                      className="text-sm text-muted transition-colors hover:text-ink"
                    >
                      {с.имя}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {снимок && (
            <LocalizedClientLink
              href="/store"
              onClick={() => setОткрыт(false)}
              className="relative block aspect-[4/3] w-full overflow-hidden bg-mist"
            >
              <Image
                src={снимок}
                alt=""
                fill
                sizes="40vw"
                className="object-cover object-center"
              />
            </LocalizedClientLink>
          )}
        </div>
      </div>
    </div>
  )
}
