import { Suspense } from "react"

import { OptionValueIds } from "@lib/util/product-option-filters"
import {
  ВыбранныеФильтры,
  идыПоиска,
  найтиТовары,
  собратьПризнаки,
} from "@lib/data/facets"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import FilterBar from "@modules/store/components/filter-bar"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

import PaginatedProducts from "./paginated-products"

/**
 * Каталог: заголовок по центру, сетка во всю ширину. Сортировка стоит
 * компактной строкой над сеткой, а не отдельной колонкой слева —
 * колонка съедала треть экрана и сдвигала товары.
 */
const StoreTemplate = async ({
  sortBy,
  page,
  countryCode,
  optionValueIds,
  фильтры,
  запрос,
  заголовок = "Все товары",
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  optionValueIds?: OptionValueIds
  фильтры?: ВыбранныеФильтры
  /** слово из поиска: сужает и сетку, и фильтр */
  запрос?: string
  заголовок?: string
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  // Когда пришли из поиска, каталог для этой страницы — только находки.
  // Их id считаем один раз и передаём и в фильтр, и в отбор: иначе рядом
  // с галочками стояли бы числа всего магазина.
  const находки = запрос ? await идыПоиска(запрос) : undefined

  const [признаки, отобранные] = await Promise.all([
    собратьПризнаки(undefined, находки),
    найтиТовары(фильтры ?? {}, undefined, находки),
  ])

  return (
    // Поля по бокам шире: от 1280 px в ряду пять карточек того же размера,
    // что были при шести, а место шестой ушло в поля (встреча 23 октября)
    <div className="content-container pt-6 pb-12 medium:px-[calc(56px+8vw)]" data-testid="category-container">
      <h1
        className="mb-4 text-center text-base text-ink"
        data-testid="store-page-title"
      >
        {заголовок}
      </h1>

      <FilterBar признаки={признаки} />

      <Suspense fallback={<SkeletonProductGrid />}>
        <PaginatedProducts
          sortBy={sort}
          page={pageNumber}
          countryCode={countryCode}
          optionValueIds={optionValueIds}
          productsIds={отобранные ?? undefined}
          ничегоНеНайдено={отобранные?.length === 0}
        />
      </Suspense>
    </div>
  )
}

export default StoreTemplate
