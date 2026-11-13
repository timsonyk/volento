import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getCategoryByHandle, listCategories } from "@lib/data/categories"
import { listRegions } from "@lib/data/regions"
import { HttpTypes, StoreRegion } from "@medusajs/types"
import CategoryTemplate from "@modules/categories/templates"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { parseOptionValueIds } from "@lib/util/product-option-filters"
import { прочитатьФильтры } from "@lib/data/facets"

type Props = {
  params: Promise<{ category: string[]; countryCode: string }>
  searchParams: Promise<
    Record<string, string | string[] | undefined> & {
      sortBy?: SortOptions
      page?: string
      optionValueIds?: string | string[]
    }
  >
}

// Страница читает куки (корзина, регион), поэтому статически собраться
// не может: Next падает с DYNAMIC_SERVER_USAGE. Для каталога с живыми
// остатками динамический рендер и так уместнее.
export const dynamic = "force-dynamic"

export async function generateStaticParams() {
  const product_categories = await listCategories()

  if (!product_categories) {
    return []
  }

  const countryCodes = await listRegions().then((regions: StoreRegion[]) =>
    regions?.map((r) => r.countries?.map((c) => c.iso_2)).flat()
  )

  const categoryHandles = product_categories.map(
    (category: HttpTypes.StoreProductCategory) => category.handle
  )

  const staticParams = countryCodes
    ?.map((countryCode: string | undefined) =>
      categoryHandles.map((handle: string) => ({
        countryCode,
        category: [handle],
      }))
    )
    .flat()

  return staticParams
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  try {
    const productCategory = await getCategoryByHandle(params.category)

    // У подраздела в заголовке стоит и родитель: «Брюки» есть и женские,
    // и в «Мужском», в выдаче их было не различить.
    const родитель = productCategory.parent_category?.name
    const title =
      (родитель
        ? `${productCategory.name}, ${родитель.toLowerCase()}`
        : productCategory.name) + " | Volento"

    // Описание раздела в админке обычно пустое (пустая строка, не null),
    // поэтому запасной текст подставляем через ||.
    const description =
      productCategory.description?.trim() ||
      `${productCategory.name}${родитель ? ` (${родитель.toLowerCase()})` : ""} Volento: модели в наличии, размеры и роста, доставка по России с примеркой.`

    return {
      title,
      description,
      // Полный путь: относительный «bryuki» поисковик достраивал от корня
      // сайта, и canonical указывал на несуществующую страницу
      alternates: {
        canonical: `/${params.countryCode}/categories/${params.category.join("/")}`,
      },
    }
  } catch {
    notFound()
  }
}

export default async function CategoryPage(props: Props) {
  const searchParams = await props.searchParams
  const params = await props.params
  const { sortBy, page } = searchParams
  const optionValueIds = parseOptionValueIds(searchParams)

  const productCategory = await getCategoryByHandle(params.category)

  if (!productCategory) {
    notFound()
  }

  const фильтры = await прочитатьФильтры(searchParams)

  return (
    <CategoryTemplate
      category={productCategory}
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
      optionValueIds={optionValueIds}
      фильтры={фильтры}
    />
  )
}
