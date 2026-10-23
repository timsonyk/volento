"use client"

import Image from "next/image"
import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"

/**
 * Снимок во весь экран: увеличение фото товара и таблица размеров.
 *
 * Снимки идут лентой вбок с прилипанием — на телефоне листаются пальцем,
 * на компьютере стрелками на экране и на клавиатуре. Закрывается
 * крестиком, клавишей Esc и нажатием мимо снимка.
 *
 * Таблицу показываем крупно и с прокруткой (длинный — режим «лист»):
 * на телефоне её иначе не прочитать.
 */
export default function Просмотр({
  снимки,
  начало = 0,
  подпись,
  лист = false,
  закрыть,
}: {
  снимки: string[]
  начало?: number
  подпись: string
  /** таблица: во всю ширину, листается вниз, без обрезки */
  лист?: boolean
  закрыть: () => void
}) {
  const лента = useRef<HTMLDivElement>(null)

  const к = (шаг: number) => {
    const л = лента.current
    if (л) л.scrollBy({ left: шаг * л.clientWidth, behavior: "smooth" })
  }

  useEffect(() => {
    // встаём сразу на нажатый снимок, без прокрутки на глазах
    const л = лента.current
    if (л) л.scrollLeft = начало * л.clientWidth
    const было = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const клавиша = (e: KeyboardEvent) => {
      if (e.key === "Escape") закрыть()
      if (e.key === "ArrowRight") к(1)
      if (e.key === "ArrowLeft") к(-1)
    }
    window.addEventListener("keydown", клавиша)
    return () => {
      document.body.style.overflow = было
      window.removeEventListener("keydown", клавиша)
    }
    // открыли — один раз
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const кнопка =
    "absolute z-10 flex h-11 w-11 items-center justify-center bg-paper/90 text-ink transition-opacity hover:opacity-70"

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={подпись}
      className="fixed inset-0 z-[80] bg-paper"
      data-testid="prosmotr"
    >
      <button type="button" onClick={закрыть} aria-label="Закрыть" className={`${кнопка} right-3 top-3`}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M5 5l14 14M19 5L5 19" />
        </svg>
      </button>

      {снимки.length > 1 && (
        <>
          <button type="button" onClick={() => к(-1)} aria-label="Предыдущий снимок" className={`${кнопка} left-3 top-1/2 hidden -translate-y-1/2 small:flex`}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button type="button" onClick={() => к(1)} aria-label="Следующий снимок" className={`${кнопка} right-3 top-1/2 hidden -translate-y-1/2 small:flex`}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      <div ref={лента} className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto">
        {снимки.map((src, i) => (
          <div
            key={src}
            onClick={(e) => e.target === e.currentTarget && закрыть()}
            className={`h-full w-full shrink-0 snap-center ${лист ? "overflow-y-auto px-2 py-16 small:px-16" : "relative"}`}
          >
            {лист ? (
              // таблица — обычной картинкой во всю ширину: так её можно
              // листать вниз и увеличивать пальцами
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={`${подпись} ${i + 1}`} className="mx-auto h-auto w-full max-w-[1100px]" />
            ) : (
              <Image
                src={src}
                alt={`${подпись} ${i + 1}`}
                fill
                sizes="100vw"
                quality={90}
                className="object-contain"
              />
            )}
          </div>
        ))}
      </div>
    </div>,
    document.body
  )
}
