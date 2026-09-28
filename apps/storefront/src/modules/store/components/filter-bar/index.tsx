"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { Признаки } from "@lib/data/facets"
import { clx } from "@modules/common/components/ui"

/**
 * Полоса над каталогом: слева «+ Фильтр», справа сортировка.
 *
 * Выбранное хранится в адресе страницы, а не в состоянии: так фильтр
 * переживает обновление, работает кнопка «назад» и ссылкой можно
 * поделиться. Несколько значений одного признака пишем через «~» —
 * запятая в названиях цветов уже занята.
 */

const РАЗДЕЛИТЕЛЬ = "~"

const СОРТИРОВКИ = [
  { ключ: "created_at", имя: "Новинки" },
  { ключ: "price_asc", имя: "Цена: по возрастанию" },
  { ключ: "price_desc", имя: "Цена: по убыванию" },
]

const FilterBar = ({ признаки }: { признаки: Признаки }) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [открыт, setОткрыт] = useState(false)

  const выбранные = (имя: string) =>
    (searchParams.get(имя) ?? "").split(РАЗДЕЛИТЕЛЬ).filter(Boolean)

  const новинкиВключены = searchParams.get("новинки") === "да"

  const сколькоВыбрано =
    выбранные("раздел").length +
    выбранные("сезон").length +
    выбранные("покрой").length +
    выбранные("цвет").length +
    (новинкиВключены ? 1 : 0)

  const применить = (изменить: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(searchParams.toString())
    изменить(p)
    p.delete("page") // после смены фильтра начинаем с первой страницы
    const строка = p.toString()
    router.push(строка ? `${pathname}?${строка}` : pathname, { scroll: false })
  }

  const переключить = (имя: string, значение: string) =>
    применить((p) => {
      const было = (p.get(имя) ?? "").split(РАЗДЕЛИТЕЛЬ).filter(Boolean)
      const стало = было.includes(значение)
        ? было.filter((v) => v !== значение)
        : [...было, значение]
      if (стало.length) {
        p.set(имя, стало.join(РАЗДЕЛИТЕЛЬ))
      } else {
        p.delete(имя)
      }
    })

  const сбросить = () =>
    применить((p) => {
      for (const имя of ["раздел", "сезон", "покрой", "цвет", "новинки"]) {
        p.delete(имя)
      }
    })

  const сортировка = searchParams.get("sortBy") ?? "created_at"

  const Группа = ({
    имя,
    заголовок,
    значения,
  }: {
    имя: string
    заголовок: string
    значения: {
      значение: string
      сколько: number
      код?: string
      подпись?: string
    }[]
  }) => {
    if (!значения.length) {
      return null
    }
    const выбрано = выбранные(имя)

    return (
      <div className="flex flex-col gap-y-3">
        <p className="text-xs uppercase tracking-[0.16em] text-muted">
          {заголовок}
        </p>
        <div className="flex flex-col gap-y-2">
          {значения.map((з) => {
            const отмечен = выбрано.includes(з.значение)
            return (
              <label
                key={з.значение}
                className="flex cursor-pointer items-center gap-x-3 py-1"
              >
                <input
                  type="checkbox"
                  checked={отмечен}
                  onChange={() => переключить(имя, з.значение)}
                  className="h-4 w-4 shrink-0 accent-ink"
                />
                {з.код && (
                  <span
                    aria-hidden
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-rule"
                    style={{ backgroundColor: з.код }}
                  />
                )}
                <span
                  className={clx(
                    "text-sm first-letter:uppercase",
                    отмечен ? "text-ink" : "text-muted"
                  )}
                >
                  {з.подпись ?? з.значение}
                </span>
                <span className="text-xs text-muted">{з.сколько}</span>
              </label>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={() => setОткрыт((о) => !о)}
          aria-expanded={открыт}
          className="py-1 text-sm uppercase tracking-[0.12em] text-ink"
          data-testid="filter-toggle"
        >
          {открыт ? "−" : "+"} Фильтр
          {сколькоВыбрано > 0 && (
            <span className="ml-2 text-muted">{сколькоВыбрано}</span>
          )}
        </button>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {СОРТИРОВКИ.map((с) => (
            <button
              key={с.ключ}
              type="button"
              onClick={() =>
                применить((p) => {
                  if (с.ключ === "created_at") {
                    p.delete("sortBy")
                  } else {
                    p.set("sortBy", с.ключ)
                  }
                })
              }
              className={clx(
                "py-1 text-sm underline-offset-[6px] transition-colors",
                сортировка === с.ключ
                  ? "text-ink underline"
                  : "text-muted hover:text-ink"
              )}
            >
              {с.имя}
            </button>
          ))}
        </div>
      </div>

      {открыт && (
        <div
          className="mt-5 border-t border-rule pt-6"
          data-testid="filter-panel"
        >
          <div className="grid grid-cols-1 gap-8 small:grid-cols-5">
            {признаки.новинок > 0 && (
              <div className="flex flex-col gap-y-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  Отбор
                </p>
                <label className="flex cursor-pointer items-center gap-x-3 py-1">
                  <input
                    type="checkbox"
                    checked={новинкиВключены}
                    onChange={() =>
                      применить((p) => {
                        if (новинкиВключены) {
                          p.delete("новинки")
                        } else {
                          p.set("новинки", "да")
                        }
                      })
                    }
                    className="h-4 w-4 shrink-0 accent-ink"
                  />
                  <span
                    className={clx(
                      "text-sm",
                      новинкиВключены ? "text-ink" : "text-muted"
                    )}
                  >
                    Только новинки
                  </span>
                  <span className="text-xs text-muted">{признаки.новинок}</span>
                </label>
              </div>
            )}

            <Группа
              имя="раздел"
              заголовок="Раздел"
              значения={признаки.разделы}
            />
            <Группа имя="сезон" заголовок="Сезон" значения={признаки.сезоны} />
            <Группа имя="покрой" заголовок="Покрой" значения={признаки.покрои} />
            <Группа
              имя="цвет"
              заголовок="Цвет"
              значения={признаки.цвета.slice(0, 16)}
            />
          </div>

          {сколькоВыбрано > 0 && (
            <button
              type="button"
              onClick={сбросить}
              className="mt-7 py-2 text-sm text-muted underline underline-offset-[5px] hover:text-ink"
              data-testid="filter-reset"
            >
              Сбросить всё
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default FilterBar
