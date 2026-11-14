import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import { HttpTypes } from "@medusajs/types"
import { OptionValueIds } from "@lib/util/product-option-filters"
import { listProducts } from "@lib/data/products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default async function CollectionTemplate({
  sortBy,
  collection,
  page,
  countryCode,
  optionValueIds,
}: {
  sortBy?: SortOptions
  collection: HttpTypes.StoreCollection
  page?: string
  countryCode: string
  optionValueIds?: OptionValueIds
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  // Есть ли в подборке хоть один товар: спрашиваем налегке, без цен.
  // Пустая подборка («Скидки», пока скидок нет) раньше показывала
  // заголовок, сортировку и белый лист без единого слова.
  const есть = await listProducts({
    countryCode,
    queryParams: { limit: 1, fields: "id,tags.value", collection_id: [collection.id] } as any,
    безЦен: true,
  })
    .then(({ response }) => response.products.length > 0)
    .catch(() => true)

  // Вид как у каталога: заголовок по центру, сортировка строкой над
  // сеткой. Колонка слева осталась от шаблона и сдвигала товары.
  return (
    <div className="content-container pt-6 pb-12 medium:px-[calc(56px+8vw)]">
      <h1 className="mb-4 text-center text-base text-ink" data-testid="collection-title">
        {collection.title}
      </h1>
      {есть ? (
        <>
          <RefinementList sortBy={sort} hideOptionsPicker />
          <Suspense fallback={<SkeletonProductGrid numberOfProducts={8} />}>
            <PaginatedProducts
              sortBy={sort}
              page={pageNumber}
              collectionId={collection.id}
              countryCode={countryCode}
              optionValueIds={optionValueIds}
            />
          </Suspense>
        </>
      ) : (
        <div className="py-16 text-center" data-testid="podborka-pusto">
          <p className="text-base text-muted">
            Сейчас здесь пусто. Загляните позже или посмотрите весь каталог.
          </p>
          <LocalizedClientLink
            href="/store"
            className="mt-6 inline-block border-b border-ink pb-0.5 text-base text-ink"
          >
            Смотреть весь каталог
          </LocalizedClientLink>
        </div>
      )}
    </div>
  )
}
