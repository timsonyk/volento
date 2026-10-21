import { Metadata } from "next"
import { notFound } from "next/navigation"
import { listProducts } from "@lib/data/products"
import { getRegion, listRegions } from "@lib/data/regions"
import ProductTemplate from "@modules/products/templates"
import { getBaseURL } from "@lib/util/env"
import { описаниеДляПоиска, разметкаТовара } from "@lib/util/razmetka-tovara"
import { HttpTypes } from "@medusajs/types"

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
  searchParams: Promise<{ v_id?: string }>
}

export async function generateStaticParams() {
  try {
    const countryCodes = await listRegions().then((regions) =>
      regions?.map((r) => r.countries?.map((c) => c.iso_2)).flat()
    )

    if (!countryCodes) {
      return []
    }

    // Каждую страну спрашиваем отдельно и падение одной не даём
    // превратить в падение всех: один раз удалённый регион ещё сидел в
    // кеше сборки, каталог по его стране не ответил — и без страниц
    // остался весь магазин, включая работающую Россию.
    const countryProducts = await Promise.all(
      countryCodes.map(async (country) => {
        try {
          const { response } = await listProducts({
            countryCode: country,
            queryParams: { limit: 100, fields: "handle" },
          })
          return { country, products: response.products }
        } catch (error) {
          console.error(
            `Страницы товаров: страна ${country} пропущена — ${
              error instanceof Error ? error.message : "неизвестная ошибка"
            }`
          )
          return { country, products: [] }
        }
      })
    )

    return countryProducts
      .flatMap((countryData) =>
        countryData.products.map((product) => ({
          countryCode: countryData.country,
          handle: product.handle,
        }))
      )
      .filter((param) => param.handle)
  } catch (error) {
    console.error(
      `Failed to generate static paths for product pages: ${
        error instanceof Error ? error.message : "Unknown error"
      }.`
    )
    return []
  }
}

function getImagesForVariant(
  product: HttpTypes.StoreProduct,
  selectedVariantId?: string
) {
  if (!selectedVariantId || !product.variants) {
    return product.images
  }

  const variant = product.variants!.find((v) => v.id === selectedVariantId)
  if (!variant || !variant.images?.length) {
    return product.images
  }

  const imageIdsMap = new Map(variant.images!.map((i) => [i.id, true]))
  return product.images?.filter((i) => imageIdsMap.has(i.id)) ?? null
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const { handle } = params
  const region = await getRegion(params.countryCode)

  if (!region) {
    notFound()
  }

  const product = await listProducts({
    countryCode: params.countryCode,
    queryParams: { handle },
  }).then(({ response }) => response.products[0])

  if (!product) {
    notFound()
  }

  // в выдаче описание вместо повтора названия; адрес без ?v_id —
  // размер в адресе не делает страницу другой
  const описание = описаниеДляПоиска(product)
  return {
    title: `${product.title} | Volento`,
    description: описание,
    alternates: { canonical: `/${params.countryCode}/products/${handle}` },
    openGraph: {
      title: `${product.title} | Volento`,
      description: описание,
      type: "website",
      images: product.thumbnail ? [product.thumbnail] : [],
    },
  }
}

export default async function ProductPage(props: Props) {
  const params = await props.params
  const region = await getRegion(params.countryCode)
  const searchParams = await props.searchParams

  const selectedVariantId = searchParams.v_id

  if (!region) {
    notFound()
  }

  const pricedProduct = await listProducts({
    countryCode: params.countryCode,
    queryParams: { handle: params.handle },
  }).then(({ response }) => response.products[0])

  if (!pricedProduct) {
    notFound()
  }

  // Служебные записи (баннер главной) — не товары: своей страницы у них нет.
  if (pricedProduct.tags?.some((t) => t.value === "system")) {
    notFound()
  }

  const images = getImagesForVariant(pricedProduct, selectedVariantId)

  const разметка = разметкаТовара(
    pricedProduct,
    `${getBaseURL()}/${params.countryCode}/products/${params.handle}`
  )

  return (
    <>
      <script
        type="application/ld+json"
        // «<» экранируем: в названии или описании не должна закрыться
        // сама разметка
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(разметка).replace(/</g, "\\u003c"),
        }}
      />
      <ProductTemplate
        product={pricedProduct}
        region={region}
        countryCode={params.countryCode}
        images={images ?? []}
      />
    </>
  )
}
