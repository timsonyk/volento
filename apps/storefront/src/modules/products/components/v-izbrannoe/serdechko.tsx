"use client"

import { useEffect, useState } from "react"

import {
  Избранная,
  СОБЫТИЕ,
  прочитатьИзбранное,
  переключитьИзбранное,
} from "@lib/util/izbrannoe"

/**
 * Сердечко в углу карточки каталога: отложить вещь, не открывая её.
 * Лежит поверх фото рядом со ссылкой карточки, а не внутри неё: кнопка
 * внутри ссылки открывала бы товар.
 */
const Сердечко = ({ вещь }: { вещь: Избранная }) => {
  const [есть, setЕсть] = useState(false)

  useEffect(() => {
    const сверить = () =>
      setЕсть(прочитатьИзбранное().some((в) => в.handle === вещь.handle))
    сверить()
    window.addEventListener(СОБЫТИЕ, сверить)
    return () => window.removeEventListener(СОБЫТИЕ, сверить)
  }, [вещь.handle])

  return (
    <button
      type="button"
      aria-pressed={есть}
      aria-label={есть ? "Убрать из избранного" : "В избранное"}
      onClick={() => setЕсть(переключитьИзбранное(вещь))}
      className="absolute right-1 top-1 z-10 flex h-10 w-10 items-center justify-center text-ink [filter:drop-shadow(0_0_2px_rgba(255,255,255,0.9))]"
      data-testid="serdechko"
    >
      <svg
        aria-hidden
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill={есть ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
      </svg>
    </button>
  )
}

export default Сердечко
