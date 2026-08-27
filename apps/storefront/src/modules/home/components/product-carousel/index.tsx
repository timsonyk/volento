"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Обёртка ленты со стрелками. Стрелки появляются при наведении и
 * прячутся, когда листать в эту сторону уже некуда.
 */
export default function ProductCarousel({
  children,
}: {
  children: React.ReactNode
}) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = useCallback(() => {
    const el = trackRef.current
    if (!el) {
      return
    }
    setCanLeft(el.scrollLeft > 8)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
  }, [])

  useEffect(() => {
    update()
    const el = trackRef.current
    el?.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      el?.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [update])

  const scrollBy = (direction: 1 | -1) => {
    const el = trackRef.current
    if (!el) {
      return
    }
    // листаем примерно на одну карточку
    el.scrollBy({ left: direction * el.clientWidth * 0.28, behavior: "smooth" })
  }

  const arrow =
    "absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center bg-paper/90 text-ink opacity-0 transition-opacity duration-200 group-hover:opacity-100 small:flex"

  return (
    <div className="group relative">
      <button
        type="button"
        aria-label="Предыдущие товары"
        onClick={() => scrollBy(-1)}
        disabled={!canLeft}
        className={`${arrow} left-2 disabled:pointer-events-none disabled:opacity-0`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="h-5 w-5">
          <path d="M15 5 8 12l7 7" />
        </svg>
      </button>

      <ul
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-x-2 overflow-x-auto pb-1 pl-[max(1.5rem,calc((100vw-1440px)/2+1.5rem))] pr-6"
      >
        {children}
      </ul>

      <button
        type="button"
        aria-label="Следующие товары"
        onClick={() => scrollBy(1)}
        disabled={!canRight}
        className={`${arrow} right-2 disabled:pointer-events-none disabled:opacity-0`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="h-5 w-5">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
