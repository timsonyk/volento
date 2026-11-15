import { listModelColors, listProductsWithSort } from "@lib/data/products"
import { дляКарточки } from "@lib/util/dlya-kartochki"
import { getRegion } from "@lib/data/regions"
import { OptionValueIds } from "@lib/util/product-option-filters"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductGrid from "@modules/store/components/product-grid"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

// Порция делится на число карточек в ряду — 2, 4 и 5, — поэтому
// последний ряд всегда полный. При 12 и пяти в ряду в конце оставалось
// две карточки, и казалось, что часть не показалась.
const PRODUCT_LIMIT = 20

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
  естьФильтры = true,
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
  /** покупатель что-то выбрал в фильтрах (от этого зависит текст пустого списка) */
  естьФильтры?: boolean
}) {
  // Пустой список id в запрос не отправляем: Medusa поймёт его как
  // «без условия» и вернёт весь каталог, хотя показать надо ничего.
  // Пустой раздел без фильтров — не «ничего не нашлось»: совет снять
  // фильтры тут сбивал с толку, снимать было нечего.
  const пусто = естьФильтры ? (
    <p className="py-16 text-center text-base text-muted">
      По выбранным условиям ничего не нашлось. Попробуйте снять часть
      фильтров.
    </p>
  ) : (
    <p className="py-16 text-center text-base text-muted" data-testid="pustoy-razdel">
      Здесь пока нет вещей.{" "}
      <LocalizedClientLink href="/store" className="text-ink underline underline-offset-4">
        Смотреть весь каталог
      </LocalizedClientLink>
    </p>
  )

  if (ничегоНеНайдено) {
    return пусто
  }

  const queryParams: PaginatedProductsParams = {
    limit: PRODUCT_LIMIT,
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

  if (!count) {
    return пусто
  }

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
