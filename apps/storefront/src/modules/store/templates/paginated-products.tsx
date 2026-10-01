import { listModelColors, listProductsWithSort } from "@lib/data/products"
import { дляКарточки } from "@lib/util/dlya-kartochki"
import { getRegion } from "@lib/data/regions"
import { OptionValueIds } from "@lib/util/product-option-filters"
import ProductGrid from "@modules/store/components/product-grid"
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
  ничегоНеНайдено,
}: {
  sortBy?: SortOptions
  page: number
  collectionId?: string
  categoryIds?: string[]
  productsIds?: string[]
  countryCode: string
  optionValueIds?: OptionValueIds
  /** фильтр отработал и не нашёл ни одного товара */
  ничегоНеНайдено?: boolean
}) {
  // Пустой список id в запрос не отправляем: Medusa поймёт его как
  // «без условия» и вернёт весь каталог, хотя показать надо ничего.
  if (ничегоНеНайдено) {
    return (
      <p className="py-16 text-center text-base text-muted">
        По выбранным условиям ничего не нашлось. Попробуйте снять часть
        фильтров.
      </p>
    )
  }

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
    <ProductGrid
      начальные={products.map(дляКарточки)}
      начальныеЦвета={colorsByModel}
      region={region}
      страница={page}
      всегоСтраниц={totalPages}
      естьЕщёСразу={page * PRODUCT_LIMIT < count}
      queryParams={queryParams}
      sortBy={sortBy}
      countryCode={countryCode}
      optionValueIds={optionValueIds}
    />
  )
}
