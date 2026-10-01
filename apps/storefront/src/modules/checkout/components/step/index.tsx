"use client"

import { useEffect, useRef, useState } from "react"

import { clx } from "@modules/common/components/ui"

/**
 * Один пункт оформления заказа.
 *
 * Пункты идут по порядку и открываются по одному: пока не заполнен
 * предыдущий, следующий показан бледным и не нажимается. Так человек не
 * выбирает способ оплаты раньше, чем назвал город, и не видит пустой
 * список служб доставки.
 *
 * Закрытый пункт не просто «не реагирует»: по нажатию всплывает плашка с
 * тем, что нужно сделать раньше, — иначе непонятно, сломалось оно или
 * так задумано. Плашка появляется там, куда ткнули, и гаснет сама.
 *
 * Внутри закрытого пункта стоит выключенный fieldset: он разом гасит все
 * поля и кнопки внутри и, что важнее, убирает их из обхода по Tab.
 * Одного прозрачного слоя сверху для этого мало.
 */
const ПРЯТАТЬ_ЧЕРЕЗ = 2600

const Шаг = ({
  номер,
  заголовок,
  подпись,
  открыт,
  готов,
  почему,
  первый,
  мелкий,
  children,
}: {
  /** без номера — пункт-итог, не шаг по порядку */
  номер?: number
  заголовок: string
  подпись?: string
  открыт: boolean
  готов: boolean
  почему: string
  первый?: boolean
  /** заголовок поменьше: для итогового пункта, чтобы не спорил с шагами */
  мелкий?: boolean
  children: React.ReactNode
}) => {
  const [плашка, setПлашка] = useState<{ x: number; y: number } | null>(null)
  const таймер = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(таймер.current), [])

  // Пункт открылся — подсказка про него больше не нужна.
  useEffect(() => {
    if (открыт) {
      setПлашка(null)
    }
  }, [открыт])

  const показать = (e: React.MouseEvent<HTMLDivElement>) => {
    const рамка = e.currentTarget.getBoundingClientRect()
    setПлашка({ x: e.clientX - рамка.left, y: e.clientY - рамка.top })
    window.clearTimeout(таймер.current)
    таймер.current = window.setTimeout(() => setПлашка(null), ПРЯТАТЬ_ЧЕРЕЗ)
  }

  return (
    <section
      aria-label={заголовок}
      data-testid={`шаг-${номер ?? "итог"}`}
      className={clx(
        // Разделитель ставим сверху у всех, кроме первого: так пункты
        // отделены друг от друга, но страница не начинается с линии.
        !первый && "mt-9 border-t border-rule pt-9"
      )}
    >
      <div className="mb-4 flex items-baseline gap-x-3">
        {/* Цифра того же кегля, что и заголовок: мелкий номер сбоку
            выглядел случайной пометкой, а не нумерацией пунктов. */}
        {номер !== undefined && (
          <span
            className={clx(
              "text-3xl-regular tabular-nums transition-colors",
              открыт ? "text-ink" : "text-muted"
            )}
            aria-hidden
          >
            {номер}
          </span>
        )}

        <h2
          className={clx(
            мелкий ? "text-lg leading-snug" : "text-3xl-regular",
            "transition-colors",
            открыт ? "text-ink" : "text-muted"
          )}
        >
          {заголовок}
        </h2>

        {готов && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 self-center text-ink"
            aria-label="пункт пройден"
          >
            <path d="m5 12.5 4.5 4.5L19 7" />
          </svg>
        )}
      </div>

      {открыт && подпись && (
        <p className="-mt-2 mb-4 max-w-lg text-sm leading-relaxed text-muted">
          {подпись}
        </p>
      )}

      <div className="relative">
        <fieldset
          disabled={!открыт}
          className={clx(
            "m-0 min-w-0 border-0 p-0 transition-opacity duration-200",
            !открыт && "opacity-40 saturate-0"
          )}
        >
          {children}
        </fieldset>

        {!открыт && (
          <div
            onClick={показать}
            className="absolute inset-0 z-20 cursor-not-allowed"
            data-testid={`замок-${номер ?? "итог"}`}
          />
        )}

        {плашка && (
          <div
            style={{ left: плашка.x, top: плашка.y }}
            className="pointer-events-none absolute z-30 max-w-[240px] -translate-x-1/2 -translate-y-[calc(100%+10px)] bg-ink px-3 py-2 text-[13px] leading-snug text-paper shadow-[0_4px_16px_rgba(0,0,0,0.18)]"
            role="status"
          >
            {почему}
            <span
              className="absolute left-1/2 top-full -translate-x-1/2 border-[5px] border-transparent border-t-ink"
              aria-hidden
            />
          </div>
        )}
      </div>
    </section>
  )
}

export default Шаг
