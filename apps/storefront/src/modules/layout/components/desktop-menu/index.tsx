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

/**
 * Подчёркивание, растущее из центра в обе стороны при наведении.
 * Линия нарисована псевдоэлементом и всегда на месте — меняется только
 * её ширина по горизонтали, поэтому соседние слова не съезжают.
 */
const ПОДЧЁРКИВАНИЕ =
  "relative after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full " +
  "after:origin-center after:scale-x-0 after:bg-ink after:transition-transform " +
  "after:duration-300 after:ease-out hover:after:scale-x-100 " +
  "focus-visible:after:scale-x-100 motion-reduce:after:transition-none"

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
    <div className="hidden h-full items-center small:flex">
      <nav aria-label="Разделы каталога">
        <ul className="flex items-center gap-x-7">
          {/* панель раскрывает только «Каталог»; остальные пункты при
              наведении её закрывают, иначе она висела бы над всем рядом */}
          <li onMouseEnter={открыть} onMouseLeave={закрыть}>
            <button
              type="button"
              aria-expanded={открыт}
              onFocus={открыть}
              onClick={() => setОткрыт((v) => !v)}
              className={`text-base text-ink aria-expanded:after:scale-x-100 ${ПОДЧЁРКИВАНИЕ}`}
            >
              Каталог
            </button>
          </li>
          {пункты.map((п) => (
            <li key={п.адрес} onMouseEnter={закрыть}>
              <LocalizedClientLink
                href={п.адрес}
                onFocus={закрыть}
                className={`text-base text-ink ${ПОДЧЁРКИВАНИЕ}`}
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
        onMouseEnter={открыть}
        onMouseLeave={закрыть}
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
              <p className="mb-6 text-base text-ink">{к.заголовок}</p>
              <ul className="flex flex-col gap-y-3">
                {к.ссылки.map((с) => (
                  <li key={с.адрес}>
                    <LocalizedClientLink
                      href={с.адрес}
                      onClick={() => setОткрыт(false)}
                      className="text-base text-muted transition-colors hover:text-ink"
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
