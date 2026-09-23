import { notFound } from "next/navigation"
import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { OptionValueIds } from "@lib/util/product-option-filters"

export default function CategoryTemplate({
  category,
  sortBy,
  page,
  countryCode,
  optionValueIds,
}: {
  category: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
  optionValueIds?: OptionValueIds
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

  return (
    <div className="content-container py-10" data-testid="category-container">
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
        {/* Подразделы — тихий ряд под названием, в одну строку с переносом.
            Раньше это был синий список со стрелками из стартового шаблона:
            на чёрно-белом сайте он выглядел как чужая вставка. Проверяем
            длину, а не сам массив: пустой список рисовал пустой отступ. */}
        {!!category.category_children?.length && (
          <nav className="mb-10" aria-label="Подразделы">
            <ul className="flex flex-wrap justify-center gap-x-7 gap-y-3">
              {category.category_children.map((c) => (
                <li key={c.id}>
                  <LocalizedClientLink
                    href={`/categories/${c.handle}`}
                    className="text-sm uppercase tracking-[0.08em] text-muted underline-offset-[6px] transition-colors hover:text-ink hover:underline"
                  >
                    {c.name}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="mb-6 flex justify-end">
          <RefinementList
            sortBy={sort}
            data-testid="sort-by-container"
            hideOptionsPicker
          />
        </div>

        <Suspense
          fallback={
            <SkeletonProductGrid
              numberOfProducts={category.products?.length ?? 8}
            />
          }
        >
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            categoryIds={idsРаздела}
            countryCode={countryCode}
            optionValueIds={optionValueIds}
          />
        </Suspense>
      </div>
    </div>
  )
}
