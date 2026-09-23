import { Suspense } from "react"

import { OptionValueIds } from "@lib/util/product-option-filters"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

import PaginatedProducts from "./paginated-products"

/**
 * Каталог: заголовок по центру, сетка во всю ширину. Сортировка стоит
 * компактной строкой над сеткой, а не отдельной колонкой слева —
 * колонка съедала треть экрана и сдвигала товары.
 */
const StoreTemplate = ({
  sortBy,
  page,
  countryCode,
  optionValueIds,
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  optionValueIds?: OptionValueIds
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  return (
    <div className="content-container pt-6 pb-12" data-testid="category-container">
      <h1
        className="mb-4 text-center text-base text-ink"
        data-testid="store-page-title"
      >
        Все товары
      </h1>

      <div className="mb-6 flex justify-end">
        <RefinementList sortBy={sort} />
      </div>

      <Suspense fallback={<SkeletonProductGrid />}>
        <PaginatedProducts
          sortBy={sort}
          page={pageNumber}
          countryCode={countryCode}
          optionValueIds={optionValueIds}
        />
      </Suspense>
    </div>
  )
}

export default StoreTemplate
