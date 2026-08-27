import { listModelColors, listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreview from "@modules/products/components/product-preview"

/**
 * Лента новинок сразу после баннера: карточки уходят за правый край и
 * прокручиваются вбок, как на референсе. Цвета моделей берутся одним
 * запросом на всю ленту, а не по запросу на карточку.
 */
export default async function LatestProducts({
  region,
  countryCode,
}: {
  region: HttpTypes.StoreRegion
  countryCode: string
}) {
  const {
    response: { products },
  } = await listProducts({
    regionId: region.id,
    queryParams: {
      limit: 12,
      order: "-created_at",
      fields: "*variants.calculated_price,+metadata,+tags",
    },
  })

  if (!products?.length) {
    return null
  }

  const colorsByModel = await listModelColors({ products, countryCode })

  return (
    <section className="py-14 small:py-20">
      <div className="content-container mb-8 flex items-baseline justify-between border-b border-rule pb-6">
        <h2 className="font-display text-2xl leading-tight text-ink small:text-3xl">
          Новинки
        </h2>
        <LocalizedClientLink
          href="/store"
          className="label-type link-underline text-ink"
        >
          Весь каталог
        </LocalizedClientLink>
      </div>

      {/* Лента во всю ширину: слева выравнена по общему контейнеру,
          справа уходит за край экрана — так видно, что можно листать. */}
      <ul className="no-scrollbar flex snap-x snap-mandatory gap-x-3 overflow-x-auto pb-1 pl-[max(1.5rem,calc((100vw-1440px)/2+1.5rem))] pr-6">
        {products.map((product) => (
          <li
            key={product.id}
            className="w-[68vw] shrink-0 snap-start xsmall:w-[44vw] small:w-[23vw]"
          >
            <ProductPreview
              product={product}
              region={region}
              colors={colorsByModel[product.metadata?.model as string]}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
