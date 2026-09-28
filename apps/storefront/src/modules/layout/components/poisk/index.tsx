"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import type { Находки } from "@lib/data/poisk"
import { искатьТовары } from "@lib/data/poisk"
import { SearchIcon } from "@modules/common/icons/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreview from "@modules/products/components/product-preview"

/**
 * Поиск по каталогу всплывающей шторкой.
 *
 * Открывается поверх страницы сверху, во всю ширину, и сразу забирает
 * ввод. Пока человек печатает, под строкой показываются первые находки;
 * по Enter он уходит на страницу поиска со всем списком и фильтрами.
 *
 * Ищем не на каждое нажатие, а когда человек перестал печатать: иначе на
 * слово «брюки» уходило бы пять запросов подряд, и приходили бы они не по
 * порядку — на экране мог оказаться ответ на «брю».
 */
const ЖДАТЬ_ПОСЛЕ_ВВОДА = 300

export default function Поиск({
  countryCode,
  region,
  className = "",
  "data-testid": testid,
}: {
  countryCode: string
  region: any
  className?: string
  "data-testid"?: string
}) {
  const [открыт, setОткрыт] = useState(false)
  const [запрос, setЗапрос] = useState("")
  const [находки, setНаходки] = useState<Находки | null>(null)
  const [ищем, начатьПоиск] = useTransition()
  const поле = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Ввод забираем сразу: человек нажал лупу, чтобы печатать, а не чтобы
  // потом ещё раз целиться в строку.
  useEffect(() => {
    if (открыт) {
      поле.current?.focus()
    }
  }, [открыт])

  // Пока шторка открыта, страница под ней не прокручивается.
  useEffect(() => {
    if (!открыт) return
    const было = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = было
    }
  }, [открыт])

  useEffect(() => {
    if (!открыт) return
    const поEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") закрыть()
    }
    document.addEventListener("keydown", поEscape)
    return () => document.removeEventListener("keydown", поEscape)
  }, [открыт])

  useEffect(() => {
    if (!открыт) return
    const таймер = setTimeout(() => {
      начатьПоиск(async () => setНаходки(await искатьТовары(запрос, countryCode)))
    }, ЖДАТЬ_ПОСЛЕ_ВВОДА)
    return () => clearTimeout(таймер)
  }, [запрос, открыт, countryCode])

  const закрыть = () => {
    setОткрыт(false)
    setЗапрос("")
    setНаходки(null)
  }

  const отправить = (e: React.FormEvent) => {
    e.preventDefault()
    const чистый = запрос.trim()
    if (!чистый) return
    закрыть()
    router.push(`/${countryCode}/search?q=${encodeURIComponent(чистый)}`)
  }

  const естьЧтоПоказать = (находки?.товары.length ?? 0) > 0
  const искалиИНеНашли =
    !ищем && запрос.trim().length >= 2 && находки?.запрос === запрос.trim() && !естьЧтоПоказать

  return (
    <>
      <button
        type="button"
        aria-label="Поиск по каталогу"
        onClick={() => setОткрыт(true)}
        className={`transition-opacity hover:opacity-60 ${className}`}
        data-testid={testid}
      >
        <SearchIcon />
      </button>

      {открыт && (
        <div className="fixed inset-0 z-50" data-testid="poisk-shtorka">
          {/* затемнение: нажатие мимо шторки закрывает её */}
          <div
            className="absolute inset-0 bg-ink/30"
            onClick={закрыть}
            aria-hidden
          />

          <div className="absolute inset-x-0 top-0 max-h-[88vh] overflow-y-auto bg-paper">
            <form onSubmit={отправить} className="content-container">
              <div className="flex items-center gap-x-4 py-5">
                <SearchIcon />
                <input
                  ref={поле}
                  value={запрос}
                  onChange={(e) => setЗапрос(e.target.value)}
                  placeholder="Поиск"
                  aria-label="Что ищете"
                  className="min-w-0 flex-1 bg-transparent text-lg text-ink outline-none placeholder:text-muted"
                  data-testid="poisk-pole"
                />
                {запрос && (
                  <button
                    type="button"
                    onClick={() => setЗапрос("")}
                    className="text-sm uppercase tracking-[0.12em] text-muted transition-colors hover:text-ink"
                  >
                    Очистить
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Закрыть поиск"
                  onClick={закрыть}
                  className="text-ink transition-opacity hover:opacity-60"
                  data-testid="poisk-zakryt"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="h-6 w-6">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </form>

            {(естьЧтоПоказать || искалиИНеНашли) && (
              <div className="content-container border-t border-rule pb-10 pt-6">
                {искалиИНеНашли ? (
                  <p className="text-sm text-muted">
                    По запросу «{запрос.trim()}» ничего не нашлось. Попробуйте
                    другое слово — например, «палаццо» или «лён».
                  </p>
                ) : (
                  <>
                    <p className="mb-5 text-sm text-muted">
                      Товары{находки?.всего ? ` — ${находки.всего}` : ""}
                    </p>
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-8 small:grid-cols-4">
                      {находки!.товары.map((т) => (
                        <li key={т.id} onClick={закрыть}>
                          <ProductPreview
                            product={т}
                            region={region}
                            colors={
                              находки!.цветаПоМодели[т.metadata?.model as string]
                            }
                          />
                        </li>
                      ))}
                    </ul>

                    {(находки?.всего ?? 0) > находки!.товары.length && (
                      <LocalizedClientLink
                        href={`/search?q=${encodeURIComponent(запрос.trim())}`}
                        onClick={закрыть}
                        className="mt-8 inline-block text-sm text-ink underline underline-offset-4 decoration-rule transition-colors hover:decoration-ink"
                      >
                        Показать все {находки!.всего}
                      </LocalizedClientLink>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
