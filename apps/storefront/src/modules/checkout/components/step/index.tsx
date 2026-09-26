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
  children,
}: {
  номер: number
  заголовок: string
  подпись?: string
  открыт: boolean
  готов: boolean
  почему: string
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
    <section aria-label={заголовок} data-testid={`шаг-${номер}`}>
      <div className="mb-5 flex items-center gap-x-3">
        <span
          className={clx(
            "flex h-7 w-7 shrink-0 items-center justify-center border text-[13px] transition-colors",
            готов
              ? "border-ink bg-ink text-paper"
              : открыт
                ? "border-ink text-ink"
                : "border-rule text-muted"
          )}
          aria-hidden
        >
          {готов ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="m5 12.5 4.5 4.5L19 7" />
            </svg>
          ) : (
            номер
          )}
        </span>

        <h2
          className={clx(
            "text-3xl-regular transition-colors",
            открыт ? "text-ink" : "text-muted"
          )}
        >
          {заголовок}
        </h2>
      </div>

      {открыт && подпись && (
        <p className="-mt-3 mb-5 max-w-lg text-sm leading-relaxed text-muted">
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
            data-testid={`замок-${номер}`}
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
