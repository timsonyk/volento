"use client"

import { useEffect, useState } from "react"

import { СОБЫТИЕ, прочитатьИзбранное } from "@lib/util/izbrannoe"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Сердечко в шапке со счётчиком отложенных вещей. Только на компьютере:
 * на телефоне в шапке уже четыре значка, там «Избранное» стоит в меню.
 */
const ЗначокИзбранного = () => {
  const [сколько, setСколько] = useState(0)

  useEffect(() => {
    const сверить = () => setСколько(прочитатьИзбранное().length)
    сверить()
    window.addEventListener(СОБЫТИЕ, сверить)
    // список могли поменять в другой вкладке
    window.addEventListener("storage", сверить)
    return () => {
      window.removeEventListener(СОБЫТИЕ, сверить)
      window.removeEventListener("storage", сверить)
    }
  }, [])

  return (
    <LocalizedClientLink
      href="/izbrannoe"
      aria-label={сколько ? `Избранное, вещей: ${сколько}` : "Избранное"}
      className="relative hidden transition-opacity hover:opacity-60 small:block"
      data-testid="nav-izbrannoe-link"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        aria-hidden
        className="h-[39px] w-[39px]"
      >
        <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
      </svg>
      {сколько > 0 && (
        <span className="absolute -right-2 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-ink px-1 text-[10px] leading-none text-paper">
          {сколько}
        </span>
      )}
    </LocalizedClientLink>
  )
}

export default ЗначокИзбранного
