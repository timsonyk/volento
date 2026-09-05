"use client"

import { useEffect, useState } from "react"

/**
 * Узкая полоса с акцией над шапкой.
 *
 * Текст и то, показывать ли её вообще, задаются в админке.
 *
 * На компьютере полоса уезжает вверх при первой же прокрутке и больше не
 * возвращается: место в шапке дороже объявления, которое уже прочитали.
 * На телефоне остаётся на месте — там страницу листают постоянно, и полоса
 * исчезала бы, толком не показавшись.
 */
export default function PromoBar({ текст }: { текст: string }) {
  const [спрятана, setСпрятана] = useState(false)

  useEffect(() => {
    const компьютер = window.matchMedia("(min-width: 1024px)")
    if (!компьютер.matches) {
      return
    }

    const прокрутка = () => {
      if (window.scrollY > 8) {
        setСпрятана(true)
        window.removeEventListener("scroll", прокрутка)
      }
    }

    // страницу могли открыть уже прокрученной — например, по ссылке с якорем
    прокрутка()
    window.addEventListener("scroll", прокрутка, { passive: true })
    return () => window.removeEventListener("scroll", прокрутка)
  }, [])

  return (
    <div
      aria-hidden={спрятана}
      className={
        "flex items-center justify-center overflow-hidden bg-ink transition-[height,opacity] duration-300 ease-out motion-reduce:transition-none " +
        (спрятана ? "h-0 opacity-0" : "h-[26px] opacity-100")
      }
    >
      <span className="label-type whitespace-nowrap text-paper/90">{текст}</span>
    </div>
  )
}
