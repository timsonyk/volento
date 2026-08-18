import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreview from "@modules/products/components/product-preview"

/**
 * Товарная сетка на главной. Коллекции у нас пока не заведены, поэтому
 * показываем последние добавленные модели, а не пустой блок.
 */
export default async function LatestProducts({
  region,
}: {
  region: HttpTypes.StoreRegion
}) {
  const {
    response: { products },
  } = await listProducts({
    regionId: region.id,
    queryParams: {
      limit: 8,
      order: "-created_at",
      fields: "*variants.calculated_price,+metadata",
    },
  })

  if (!products?.length) {
    return null
  }

  return (
    <section className="content-container py-14 small:py-20">
      <div className="mb-10 flex items-baseline justify-between border-b border-rule pb-6">
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

      <ul className="grid grid-cols-2 gap-x-4 gap-y-12 small:grid-cols-4 small:gap-x-6">
        {products.map((product) => (
          <li key={product.id}>
            <ProductPreview product={product} region={region} />
          </li>
        ))}
      </ul>
    </section>
  )
}
