import { listModelColors, listProductsWithSort } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { OptionValueIds } from "@lib/util/product-option-filters"
import ProductPreview from "@modules/products/components/product-preview"
import { Pagination } from "@modules/store/components/pagination"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

const PRODUCT_LIMIT = 12

type PaginatedProductsParams = {
  limit: number
  collection_id?: string[]
  category_id?: string[]
  id?: string[]
  order?: string
}

export default async function PaginatedProducts({
  sortBy,
  page,
  collectionId,
  categoryIds,
  productsIds,
  countryCode,
  optionValueIds,
}: {
  sortBy?: SortOptions
  page: number
  collectionId?: string
  categoryIds?: string[]
  productsIds?: string[]
  countryCode: string
  optionValueIds?: OptionValueIds
}) {
  const queryParams: PaginatedProductsParams = {
    limit: 12,
  }

  if (collectionId) {
    queryParams["collection_id"] = [collectionId]
  }

  // Разделов может быть несколько: в «Брюках» товаров нет — они лежат в
  // «Прямых», «Зауженных» и «Широких». Поэтому у раздела с подразделами
  // спрашиваем товары его самого и всех потомков сразу, иначе страница
  // раздела верхнего уровня оказывалась пустой.
  if (categoryIds?.length) {
    queryParams["category_id"] = categoryIds
  }

  if (productsIds) {
    queryParams["id"] = productsIds
  }

  if (sortBy === "created_at") {
    queryParams["order"] = "created_at"
  }

  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  const {
    response: { products, count },
  } = await listProductsWithSort({
    page,
    queryParams,
    sortBy,
    countryCode,
    optionValueIds,
  })

  // цвета всех моделей страницы — одним запросом, а не по одному на карточку
  const colorsByModel = await listModelColors({ products, countryCode })

  const totalPages = Math.ceil(count / PRODUCT_LIMIT)

  return (
    <>
      <ul
        className="grid w-full grid-cols-2 gap-x-2 gap-y-7 small:grid-cols-3 medium:grid-cols-4"
        data-testid="products-list"
      >
        {products.map((p) => {
          return (
            <li key={p.id}>
              <ProductPreview
                product={p}
                region={region}
                colors={colorsByModel[p.metadata?.model as string]}
              />
            </li>
          )
        })}
      </ul>
      {totalPages > 1 && (
        <Pagination
          data-testid="product-pagination"
          page={page}
          totalPages={totalPages}
        />
      )}
    </>
  )
}
