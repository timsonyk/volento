"use client"

import { useEffect, useState, useTransition } from "react"

import { следующаяСтраницаТоваров } from "@lib/data/products"
import { OptionValueIds } from "@lib/util/product-option-filters"
import { HttpTypes } from "@medusajs/types"
import ProductPreview from "@modules/products/components/product-preview"
import { Pagination } from "@modules/store/components/pagination"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { ModelColor } from "types/global"

/**
 * Сетка каталога с кнопкой «Показать ещё».
 *
 * Первая страница приходит с сервера отрисованной — её видно сразу.
 * Дальше догружаем по двенадцать и дописываем снизу, не перезагружая
 * страницу: листать каталог постранично, когда в разделе три сотни
 * моделей, неудобно.
 *
 * Постраничная навигация остаётся под кнопкой — по ней можно прыгнуть
 * далеко и поделиться ссылкой на конкретную страницу.
 */
const ProductGrid = ({
  начальные,
  начальныеЦвета,
  region,
  страница,
  всегоСтраниц,
  естьЕщёСразу,
  queryParams,
  sortBy,
  countryCode,
  optionValueIds,
}: {
  начальные: HttpTypes.StoreProduct[]
  начальныеЦвета: Record<string, ModelColor[]>
  region: HttpTypes.StoreRegion
  страница: number
  всегоСтраниц: number
  естьЕщёСразу: boolean
  queryParams?: Record<string, unknown>
  sortBy?: SortOptions
  countryCode: string
  optionValueIds?: OptionValueIds
}) => {
  const [товары, setТовары] = useState(начальные)
  const [цвета, setЦвета] = useState(начальныеЦвета)
  const [последняя, setПоследняя] = useState(страница)
  const [естьЕщё, setЕстьЕщё] = useState(естьЕщёСразу)
  const [грузится, начатьЗагрузку] = useTransition()
  const [ошибка, setОшибка] = useState<string | null>(null)

  // Сменили сортировку, раздел или страницу — начинаем заново с того,
  // что прислал сервер, иначе к новому списку прилипали бы старые товары.
  useEffect(() => {
    setТовары(начальные)
    setЦвета(начальныеЦвета)
    setПоследняя(страница)
    setЕстьЕщё(естьЕщёСразу)
    setОшибка(null)
  }, [начальные, начальныеЦвета, страница, естьЕщёСразу])

  const показатьЕщё = () => {
    начатьЗагрузку(async () => {
      try {
        setОшибка(null)
        const ответ = await следующаяСтраницаТоваров({
          page: последняя + 1,
          queryParams,
          sortBy,
          countryCode,
          optionValueIds,
        })

        setТовары((было) => {
          const заняты = new Set(было.map((p) => p.id))
          return [...было, ...ответ.products.filter((p) => !заняты.has(p.id))]
        })
        setЦвета((было) => ({ ...было, ...ответ.colorsByModel }))
        setПоследняя((n) => n + 1)
        setЕстьЕщё(ответ.естьЕщё)
      } catch {
        setОшибка("Не удалось загрузить. Попробуйте ещё раз.")
      }
    })
  }

  return (
    <>
      <ul
        // Карточки мельче (встреча 23 октября): 2 на телефоне, 4 на
        // ноутбуке, 5 от 1280 px — с широкими полями по бокам (поля задаёт
        // страница каталога).
        className="grid w-full grid-cols-2 gap-x-2 gap-y-7 small:grid-cols-4 small:gap-y-8 medium:grid-cols-5"
        data-testid="products-list"
      >
        {товары.map((p) => (
          <li key={p.id} className="h-full">
            <ProductPreview
              product={p}
              region={region}
              colors={цвета[p.metadata?.model as string]}
              // В сетке две карточки в ряд на телефоне и пять на широком
              // экране: по общей мерке (68 % экрана) телефон качал снимки
              // в полтора раза крупнее, чем показывал.
              sizes="(max-width: 1023px) 48vw, (max-width: 1279px) 24vw, 17vw"
            />
          </li>
        ))}
      </ul>

      {естьЕщё && (
        <div className="mt-10 flex flex-col items-center gap-y-3">
          <button
            type="button"
            onClick={показатьЕщё}
            disabled={грузится}
            className="border border-ink px-10 py-3.5 text-sm uppercase tracking-[0.12em] text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
            data-testid="show-more"
          >
            {грузится ? "Загружаю…" : "Показать ещё"}
          </button>
          {ошибка && <p className="text-sm text-red-600">{ошибка}</p>}
        </div>
      )}

      {всегоСтраниц > 1 && (
        <div className="mt-8">
          <Pagination
            data-testid="product-pagination"
            page={последняя}
            totalPages={всегоСтраниц}
          />
        </div>
      )}
    </>
  )
}

export default ProductGrid
