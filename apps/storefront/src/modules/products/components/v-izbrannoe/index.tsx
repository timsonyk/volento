"use client"

import { useEffect, useState } from "react"

import { Избранная, прочитатьИзбранное, переключитьИзбранное } from "@lib/util/izbrannoe"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Кнопка «В избранное» под кнопками покупки (образец). Отложить вещь,
 * не кладя её в корзину: вернуться и сравнить позже.
 */
const ВИзбранное = ({ вещь }: { вещь: Избранная }) => {
  const [есть, setЕсть] = useState(false)

  useEffect(() => {
    setЕсть(прочитатьИзбранное().some((в) => в.handle === вещь.handle))
  }, [вещь.handle])

  return (
    <div className="flex items-center justify-between gap-x-4 text-sm">
      <button
        type="button"
        aria-pressed={есть}
        onClick={() => setЕсть(переключитьИзбранное(вещь))}
        className="flex items-center gap-x-2 py-2 text-ink"
        data-testid="v-izbrannoe"
      >
        <svg
          aria-hidden
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill={есть ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
        </svg>
        {есть ? "В избранном" : "В избранное"}
      </button>
      {есть && (
        <LocalizedClientLink
          href="/izbrannoe"
          className="py-2 text-muted underline underline-offset-4 hover:text-ink"
        >
          Открыть избранное
        </LocalizedClientLink>
      )}
    </div>
  )
}

export default ВИзбранное
