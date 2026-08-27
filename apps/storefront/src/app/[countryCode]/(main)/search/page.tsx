import { Metadata } from "next"

import { listModelColors, listProductsWithSort } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import ProductPreview from "@modules/products/components/product-preview"

export const metadata: Metadata = {
  title: "Поиск | Volento",
  description: "Поиск по каталогу Volento",
}

// страница читает куки и параметр запроса — статически собраться не может
export const dynamic = "force-dynamic"

export default async function SearchPage(props: {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { countryCode } = await props.params
  const { q } = await props.searchParams
  const query = (q ?? "").trim()

  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  const {
    response: { products },
  } = query
    ? await listProductsWithSort({
        page: 1,
        countryCode,
        queryParams: { limit: 24, q: query } as any,
      })
    : { response: { products: [], count: 0 } }

  const colorsByModel = products.length
    ? await listModelColors({ products, countryCode })
    : {}

  return (
    <div className="content-container py-10 small:py-14">
      <h1 className="font-display text-2xl leading-tight text-ink small:text-3xl">
        Поиск
      </h1>

      <form
        action={`/${countryCode}/search`}
        method="get"
        role="search"
        className="mt-6 flex max-w-xl items-center gap-x-3 border-b border-ink pb-2"
      >
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Например: прямые"
          aria-label="Что ищем"
          className="w-full bg-transparent text-base text-ink outline-none placeholder:text-muted"
        />
        <button type="submit" className="label-type shrink-0 text-ink">
          Найти
        </button>
      </form>

      {query && (
        <p className="label-type mt-6 text-muted">
          {products.length > 0
            ? `Найдено: ${products.length}`
            : "Ничего не нашлось"}
        </p>
      )}

      {products.length > 0 && (
        <ul className="mt-8 grid grid-cols-2 gap-x-2 gap-y-10 small:grid-cols-4">
          {products.map((product) => (
            <li key={product.id}>
              <ProductPreview
                product={product}
                region={region}
                colors={colorsByModel[product.metadata?.model as string]}
              />
            </li>
          ))}
        </ul>
      )}

      {query && products.length === 0 && (
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
          Попробуйте другое слово — например, «прямые», «зауженные» или цвет.
        </p>
      )}
    </div>
  )
}
