import { listModelColors, listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import ProductPreview from "@modules/products/components/product-preview"

/**
 * Крупная сетка товаров с заголовком по центру — как секция каталога
 * на главной у референса.
 */
export default async function HomeProductGrid({
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
      fields: "*variants.calculated_price,+metadata,+tags",
    },
  })

  if (!products?.length) {
    return null
  }

  const colorsByModel = await listModelColors({ products, countryCode })

  return (
    <section className="content-container pb-20 small:pb-28">
      <h2 className="mb-6 text-center text-base text-ink">Все модели</h2>

      <ul className="grid grid-cols-2 gap-x-2 gap-y-10 small:grid-cols-4 small:gap-y-14">
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
    </section>
  )
}
