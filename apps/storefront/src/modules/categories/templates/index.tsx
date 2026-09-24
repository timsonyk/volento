import { notFound } from "next/navigation"
import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import FilterBar from "@modules/store/components/filter-bar"
import { ВыбранныеФильтры, найтиТовары, собратьПризнаки } from "@lib/data/facets"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { OptionValueIds } from "@lib/util/product-option-filters"

export default async function CategoryTemplate({
  category,
  sortBy,
  page,
  countryCode,
  optionValueIds,
  фильтры,
}: {
  category: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
  optionValueIds?: OptionValueIds
  фильтры?: ВыбранныеФильтры
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  if (!category || !countryCode) notFound()

  const parents = [] as HttpTypes.StoreProductCategory[]

  const getParents = (category: HttpTypes.StoreProductCategory) => {
    if (category.parent_category) {
      parents.push(category.parent_category)
      getParents(category.parent_category)
    }
  }

  getParents(category)

  // товары лежат в самых нижних разделах, поэтому у «Брюк» спрашиваем ещё
  // и товары «Прямых», «Зауженных», «Широких»
  const idsРаздела: string[] = []
  const собратьId = (c: HttpTypes.StoreProductCategory) => {
    idsРаздела.push(c.id)
    c.category_children?.forEach(собратьId)
  }
  собратьId(category)

  const [признаки, отобранные] = await Promise.all([
    собратьПризнаки(idsРаздела),
    найтиТовары(фильтры ?? {}, idsРаздела),
  ])

  return (
    <div className="content-container pt-6 pb-12" data-testid="category-container">
      <div>
        <div className="mb-4 flex flex-row items-baseline justify-center gap-4 text-base">
          {parents &&
            parents.map((parent) => (
              <span key={parent.id} className="text-ui-fg-subtle">
                <LocalizedClientLink
                  className="mr-4 hover:text-black"
                  href={`/categories/${parent.handle}`}
                  data-testid="sort-by-link"
                >
                  {parent.name}
                </LocalizedClientLink>
                /
              </span>
            ))}
          <h1 data-testid="category-page-title">{category.name}</h1>
        </div>
        {category.description && (
          <div className="mb-8 text-base-regular">
            <p>{category.description}</p>
          </div>
        )}
        <FilterBar признаки={признаки} />

        {/* заглушек столько же, сколько товаров на странице: список
            товаров категории мы больше не запрашиваем, он весил мегабайты */}
        <Suspense fallback={<SkeletonProductGrid numberOfProducts={12} />}>
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            categoryIds={idsРаздела}
            countryCode={countryCode}
            optionValueIds={optionValueIds}
            productsIds={отобранные ?? undefined}
            ничегоНеНайдено={отобранные?.length === 0}
          />
        </Suspense>
      </div>
    </div>
  )
}
