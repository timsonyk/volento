"use client"

import { useEffect, useState } from "react"

/**
 * Узкая полоса с акцией над шапкой.
 *
 * Текст и то, показывать ли её вообще, задаются в админке.
 *
 * На компьютере полоса уезжает вверх, как только страницу прокрутили, и
 * возвращается, когда вернулись к самому верху. На телефоне остаётся на
 * месте — там страницу листают постоянно, и полоса мельтешила бы.
 */
export default function PromoBar({ текст }: { текст: string }) {
  const [спрятана, setСпрятана] = useState(false)

  useEffect(() => {
    const компьютер = window.matchMedia("(min-width: 1024px)")
    if (!компьютер.matches) {
      return
    }

    // Считаем не на каждое событие прокрутки, а раз на кадр: событий
    // прилетают сотни в секунду, и без этого браузер тратит силы впустую.
    //
    // Пороги разные: прячем после 48 px, показываем ниже 12. Один общий
    // порог заставлял бы полосу мигать, когда страница стоит ровно на нём.
    //
    // Начальное состояние не трогаем: браузер восстанавливает прокрутку
    // при обновлении страницы и делает это уже после запуска этого кода —
    // из-за чего полоса пропадала сразу при заходе, до всякой прокрутки.
    let ждём = false
    const прокрутка = () => {
      if (ждём) {
        return
      }
      ждём = true
      requestAnimationFrame(() => {
        ждём = false
        const y = window.scrollY
        setСпрятана((было) => (было ? y > 12 : y > 48))
      })
    }

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
