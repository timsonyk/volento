import { listModelColors, listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import ProductCarousel from "@modules/home/components/product-carousel"
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
      <div className="content-container mb-5">
        <h2 className="text-base text-ink">Новинки</h2>
      </div>

      {/* Лента во всю ширину: слева выравнена по общему контейнеру,
          справа уходит за край экрана — так видно, что можно листать. */}
      <ProductCarousel>
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
      </ProductCarousel>
    </section>
  )
}
