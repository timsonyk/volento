"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Горизонтальная лента со стрелками листания.
 *
 * На телефоне ленту листают пальцем, и стрелки там не нужны. На
 * компьютере с мышью прокрутить её вбок нечем: колесо крутит страницу,
 * а не ленту, — оставалось только жать стрелки на клавиатуре. Поэтому
 * от планшета и шире показываем кнопки.
 *
 * Стрелка гаснет, когда листать в её сторону уже некуда.
 */
const ScrollRow = ({
  children,
  className = "",
  обёртка = "",
  ariaLabel,
}: {
  children: React.ReactNode
  className?: string
  /**
   * Классы для внешней рамки, а не для самого списка.
   *
   * Нужны, когда лента стоит в гибкой раскладке: растягиваться должна
   * рамка, к ней же привязаны стрелки. Если отдать flex-1 списку, рамка
   * раздувается по содержимому, уезжает за экран вместе со стрелками, а
   * прокручивать становится нечего — «видно» и «всего» совпадают.
   */
  обёртка?: string
  ariaLabel: string
}) => {
  const лента = useRef<HTMLUListElement>(null)
  const [можноВлево, setМожноВлево] = useState(false)
  const [можноВправо, setМожноВправо] = useState(false)

  const пересчитать = useCallback(() => {
    const el = лента.current
    if (!el) return
    const запас = 2 // на дробные пиксели при масштабировании
    setМожноВлево(el.scrollLeft > запас)
    setМожноВправо(el.scrollLeft + el.clientWidth < el.scrollWidth - запас)
  }, [])

  useEffect(() => {
    пересчитать()
    const el = лента.current
    if (!el) return

    el.addEventListener("scroll", пересчитать, { passive: true })
    window.addEventListener("resize", пересчитать)
    return () => {
      el.removeEventListener("scroll", пересчитать)
      window.removeEventListener("resize", пересчитать)
    }
  }, [пересчитать])

  const листать = (сторона: 1 | -1) => {
    const el = лента.current
    if (!el) return
    // на один экран минус краешек: так следующая карточка не обрезается
    const шаг = Math.max(240, el.clientWidth * 0.8)
    el.scrollBy({ left: шаг * сторона, behavior: "smooth" })
  }

  const кнопка =
    "absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center bg-paper/95 text-ink shadow-[0_2px_10px_rgba(0,0,0,0.12)] transition-opacity duration-200 xsmall:flex disabled:pointer-events-none disabled:opacity-0"

  return (
    <div className={`relative ${обёртка}`}>
      <button
        type="button"
        aria-label="Листать влево"
        onClick={() => листать(-1)}
        disabled={!можноВлево}
        className={`${кнопка} left-2 small:left-4`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="h-5 w-5">
          <path d="M15 5 8 12l7 7" />
        </svg>
      </button>

      <ul ref={лента} aria-label={ariaLabel} className={className}>
        {children}
      </ul>

      <button
        type="button"
        aria-label="Листать вправо"
        onClick={() => листать(1)}
        disabled={!можноВправо}
        className={`${кнопка} right-2 small:right-4`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="h-5 w-5">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}

export default ScrollRow
