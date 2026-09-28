import { Metadata } from "next"

import { прочитатьФильтры } from "@lib/data/facets"
import { parseOptionValueIds } from "@lib/util/product-option-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

export const metadata: Metadata = {
  title: "Поиск | Volento",
  description: "Поиск по каталогу Volento",
}

// страница читает куки и слово из адреса — статически собраться не может
export const dynamic = "force-dynamic"

type Параметры = Record<string, string | string[] | undefined> & {
  q?: string
  sortBy?: SortOptions
  page?: string
}

/**
 * Страница находок. Это тот же каталог, что и «Все товары», только
 * суженный словом из поиска: фильтры, сортировка и подгрузка работают
 * ровно так же, и считаются по находкам, а не по всему магазину.
 */
export default async function SearchPage(props: {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<Параметры>
}) {
  const { countryCode } = await props.params
  const searchParams = await props.searchParams
  const запрос = (searchParams.q ?? "").trim()

  const фильтры = await прочитатьФильтры(searchParams)

  return (
    <StoreTemplate
      sortBy={searchParams.sortBy}
      page={searchParams.page}
      countryCode={countryCode}
      optionValueIds={parseOptionValueIds(searchParams)}
      фильтры={фильтры}
      запрос={запрос || undefined}
      заголовок={запрос ? `Поиск: ${запрос}` : "Поиск"}
    />
  )
}
