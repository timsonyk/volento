import { Metadata } from "next"

import { прочитатьФильтры } from "@lib/data/facets"
import { parseOptionValueIds } from "@lib/util/product-option-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

// Адрес без ?page и ?sortBy: страницы и сортировки каталога для
// поисковика одна и та же страница.
export async function generateMetadata(props: {
  params: Promise<{ countryCode: string }>
}): Promise<Metadata> {
  const { countryCode } = await props.params
  return {
    title: "Каталог | Volento",
    description:
      "Каталог Volento: женские брюки, юбки, блузки и рубашки. Размеры и роста в наличии, доставка по России с примеркой.",
    alternates: { canonical: `/${countryCode}/store` },
  }
}

type StorePageSearchParams = Record<string, string | string[] | undefined> & {
  sortBy?: SortOptions
  page?: string
  optionValueIds?: string | string[]
}

type Params = {
  searchParams: Promise<StorePageSearchParams>
  params: Promise<{
    countryCode: string
  }>
}

export default async function StorePage(props: Params) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { sortBy, page } = searchParams
  const optionValueIds = parseOptionValueIds(searchParams)
  const фильтры = await прочитатьФильтры(searchParams)

  return (
    <StoreTemplate
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
      optionValueIds={optionValueIds}
      фильтры={фильтры}
    />
  )
}
