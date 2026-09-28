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

export type Колонка = { заголовок: string; адрес?: string; ссылки: Раздел[] }

/** Группа колонок под общей подписью: «Женщинам», «Мужчинам». */
export type ГруппаКолонок = { имя: string; колонки: Колонка[] }

/**
 * Подпись группы. Такая же в шторке на телефоне — и там и тут она
 * должна сразу отвечать на вопрос «почему Брюки дважды».
 * Поэтому тёмная и с большим межбуквенным просветом, а не серая мелочь.
 */
export const ПОДПИСЬ_ГРУППЫ =
  "text-[13px] uppercase tracking-[0.2em] text-ink"

export default function DesktopMenu({
  пункты,
  группы,
  снимок,
}: {
  пункты: Раздел[]
  группы: ГруппаКолонок[]
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
          {/* «Каталог» — обычная ссылка на весь каталог: панель под ней
              подсказывает разделы, но нажатие ведёт к товарам, а не просто
              раскрывает список. */}
          <li onMouseEnter={открыть} onMouseLeave={закрыть}>
            <LocalizedClientLink
              href="/store"
              aria-expanded={открыт}
              onFocus={открыть}
              onClick={() => setОткрыт(false)}
              className={`text-base text-ink aria-expanded:after:scale-x-100 ${ПОДЧЁРКИВАНИЕ}`}
            >
              Каталог
            </LocalizedClientLink>
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
        {/* В каталоге остались только разделы. «Покупателю» отсюда
            убран: справка о доставке и возврате не каталог, а место ей
            в подвале, где она и так есть, и полнее. */}
        <div className="content-container py-10">
          {/* Ширину ограничиваем и группы ставим слева: «Женщинам» стоит
              ровно под словом «Каталог» в шапке. Промежуток между
              группами больше, чем между колонками внутри, — поэтому они
              читаются расстоянием, без разделителей. */}
          <div className="flex max-w-[1280px] gap-x-24">
          {группы.map((г) => (
            <div key={г.имя} className="flex flex-col gap-y-6">
              <p className={ПОДПИСЬ_ГРУППЫ}>{г.имя}</p>
              <div className="flex gap-x-8">
                {г.колонки.map((к) => (
                  <Колонка
                    key={к.заголовок}
                    колонка={к}
                    закрыть={() => setОткрыт(false)}
                  />
                ))}
              </div>
            </div>
          ))}

          {снимок && (
            <LocalizedClientLink
              href="/store"
              onClick={() => setОткрыт(false)}
              className="relative ml-auto block aspect-[4/3] w-[38%] shrink-0 overflow-hidden bg-mist"
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
    </div>
  )
}

/** Одна колонка: заголовок раздела и ссылки под ним. */
function Колонка({
  колонка,
  закрыть,
}: {
  колонка: Колонка
  закрыть: () => void
}) {
  return (
    <div className="min-w-[140px]">
      {колонка.адрес ? (
        <LocalizedClientLink
          href={колонка.адрес}
          onClick={закрыть}
          className="mb-5 block text-base text-ink transition-opacity hover:opacity-60"
        >
          {колонка.заголовок}
        </LocalizedClientLink>
      ) : (
        <p className="mb-5 text-base text-ink">{колонка.заголовок}</p>
      )}
      <ul className="flex flex-col gap-y-3">
        {колонка.ссылки.map((с) => (
          <li key={с.адрес}>
            <LocalizedClientLink
              href={с.адрес}
              onClick={закрыть}
              className="text-base text-muted transition-colors hover:text-ink"
            >
              {с.имя}
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
