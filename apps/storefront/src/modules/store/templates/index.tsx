import { Suspense } from "react"

import { OptionValueIds } from "@lib/util/product-option-filters"
import { ВыбранныеФильтры, найтиТовары, собратьПризнаки } from "@lib/data/facets"
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
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  optionValueIds?: OptionValueIds
  фильтры?: ВыбранныеФильтры
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  const [признаки, отобранные] = await Promise.all([
    собратьПризнаки(),
    найтиТовары(фильтры ?? {}),
  ])

  return (
    <div className="content-container pt-6 pb-12" data-testid="category-container">
      <h1
        className="mb-4 text-center text-base text-ink"
        data-testid="store-page-title"
      >
        Все товары
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
