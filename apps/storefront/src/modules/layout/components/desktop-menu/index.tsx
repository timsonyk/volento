"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Меню в шапке на компьютере: слева «Каталог» и пункты рядом с ним.
 *
 * «Каталог» открывает панель слева во всю высоту, а сайт за ней
 * затемняется — так попросили на встрече 23 октября вместо широкой панели
 * с фотографией. В панели только разделы, под подписями «Женщинам» и
 * «Мужчинам», как в шторке на телефоне: мужское с женским не смешиваем.
 *
 * Открывается нажатием, а не наведением: панель большая, и случайный
 * проход курсором над шапкой не должен накрывать полстраницы. Закрывается
 * крестиком, нажатием на затемнение, клавишей Esc и переходом по ссылке.
 *
 * На телефоне меню не показывается, там своя шторка (side-menu).
 */
export type Раздел = { имя: string; адрес: string }

/** Группа разделов под подписью: «Женщинам», «Мужчинам». */
export type ГруппаРазделов = { имя: string; разделы: Раздел[] }

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

/**
 * Подпись группы. Такая же в шторке на телефоне — и там и тут она
 * должна сразу отвечать на вопрос «почему Брюки дважды».
 * Поэтому тёмная и с большим межбуквенным просветом, а не серая мелочь.
 */
export const ПОДПИСЬ_ГРУППЫ = "text-[13px] uppercase tracking-[0.2em] text-ink"

export default function DesktopMenu({
  пункты,
  группы,
}: {
  пункты: Раздел[]
  группы: ГруппаРазделов[]
}) {
  const [открыт, setОткрыт] = useState(false)
  const адрес = usePathname()

  // Перешли на другую страницу — панель закрываем сами
  useEffect(() => setОткрыт(false), [адрес])

  // Пока панель открыта: Esc закрывает, страница под ней не листается
  useEffect(() => {
    if (!открыт) return
    const клавиша = (e: KeyboardEvent) => e.key === "Escape" && setОткрыт(false)
    const было = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", клавиша)
    return () => {
      document.body.style.overflow = было
      window.removeEventListener("keydown", клавиша)
    }
  }, [открыт])

  const закрыть = () => setОткрыт(false)
  const фокус = открыт ? 0 : -1

  return (
    <div className="hidden h-full items-center small:flex">
      <nav aria-label="Разделы каталога">
        <ul className="flex items-center gap-x-8">
          <li>
            <button
              type="button"
              aria-expanded={открыт}
              aria-controls="panel-katalog"
              onClick={() => setОткрыт((о) => !о)}
              className={`text-[19px] text-ink aria-expanded:after:scale-x-100 ${ПОДЧЁРКИВАНИЕ}`}
              data-testid="menu-katalog"
            >
              Каталог
            </button>
          </li>
          {пункты.map((п) => (
            <li key={п.адрес}>
              <LocalizedClientLink href={п.адрес} className={`text-[19px] text-ink ${ПОДЧЁРКИВАНИЕ}`}>
                {п.имя}
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Затемнение и панель — поверх всего, вне потока шапки */}
      <div
        aria-hidden
        onClick={закрыть}
        className={
          "fixed inset-0 z-[60] bg-ink/40 transition-opacity duration-300 motion-reduce:transition-none " +
          (открыт ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")
        }
      />
      <aside
        id="panel-katalog"
        aria-label="Каталог"
        aria-hidden={!открыт}
        className={
          "fixed inset-y-0 left-0 z-[61] flex w-[420px] max-w-[90vw] flex-col overflow-y-auto bg-paper " +
          "transition-transform duration-300 ease-out motion-reduce:transition-none " +
          (открыт ? "translate-x-0" : "pointer-events-none -translate-x-full")
        }
        data-testid="panel-katalog"
      >
        <div className="flex h-[5.4rem] shrink-0 items-center justify-between px-10">
          <LocalizedClientLink
            href="/store"
            onClick={закрыть}
            tabIndex={фокус}
            className={`text-[19px] text-ink ${ПОДЧЁРКИВАНИЕ}`}
          >
            Весь каталог
          </LocalizedClientLink>
          <button
            type="button"
            onClick={закрыть}
            tabIndex={фокус}
            aria-label="Закрыть каталог"
            className="-mr-2 p-2 text-ink transition-opacity hover:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-y-12 px-10 pb-12 pt-6">
          {группы.map((г) => (
            <div key={г.имя} className="flex flex-col gap-y-5">
              <p className={ПОДПИСЬ_ГРУППЫ}>{г.имя}</p>
              <ul className="flex flex-col gap-y-4">
                {г.разделы.map((р) => (
                  <li key={р.адрес}>
                    <LocalizedClientLink
                      href={р.адрес}
                      onClick={закрыть}
                      tabIndex={фокус}
                      className="text-[22px] text-ink transition-opacity hover:opacity-60"
                    >
                      {р.имя}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
