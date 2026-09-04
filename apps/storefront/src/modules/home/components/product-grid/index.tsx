import { listModelColors, listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import ProductPreview from "@modules/products/components/product-preview"

/**
 * Сетка товаров на главной. По замерам референса: на телефоне две
 * карточки в ряд, каждая 47 % ширины, зазор 6 px, встык к краям;
 * на компьютере четыре в ряд тем же зазором. Заголовка над ней нет.
 *
 * Ряд ровно один. На телефоне это две карточки, поэтому третья и
 * четвёртая там прячутся — иначе получалось два ряда по две.
 *
 * Товаров показывается немного — это витринный блок, а не каталог.
 * Весь каталог живёт на своей странице.
 */
export default async function HomeProductGrid({
  region,
  countryCode,
  limit = 4,
}: {
  region: HttpTypes.StoreRegion
  countryCode: string
  limit?: number
}) {
  const {
    response: { products },
  } = await listProducts({
    regionId: region.id,
    queryParams: {
      limit,
      fields: "*variants.calculated_price,+metadata,+tags",
    },
  })

  if (!products?.length) {
    return null
  }

  const colorsByModel = await listModelColors({ products, countryCode })

  return (
    <section id="podborka-tovary" className="pb-20 small:pb-28">
      <ul className="grid grid-cols-2 gap-x-1.5 gap-y-10 [&>li:nth-child(n+3)]:hidden xsmall:grid-cols-4 xsmall:[&>li:nth-child(n+3)]:block small:gap-y-14">
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
