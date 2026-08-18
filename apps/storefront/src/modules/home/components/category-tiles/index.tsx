import { listCategories } from "@lib/data/categories"
import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"

/**
 * Плитки разделов. Обложкой служит фотография товара из раздела —
 * отдельных картинок для категорий пока нет, а ставить заглушки хуже,
 * чем показать реальную вещь.
 */
export default async function CategoryTiles({
  region,
}: {
  region: HttpTypes.StoreRegion
}) {
  const categories = (await listCategories()) ?? []
  const top = categories.filter((c) => !c.parent_category)

  if (!top.length) {
    return null
  }

  const tiles = await Promise.all(
    top.map(async (c) => {
      const {
        response: { products },
      } = await listProducts({
        regionId: region.id,
        queryParams: { limit: 1, category_id: [c.id] } as any,
      })
      return { category: c, cover: products?.[0] }
    })
  )

  const filled = tiles.filter((t) => t.cover)

  if (!filled.length) {
    return null
  }

  return (
    <section className="content-container pb-16 small:pb-24">
      <div className="mb-10 border-b border-rule pb-6">
        <h2 className="font-display text-2xl leading-tight text-ink small:text-3xl">
          Силуэты
        </h2>
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-10 small:grid-cols-3 small:gap-x-6">
        {filled.map(({ category, cover }) => (
          <li key={category.id}>
            <LocalizedClientLink
              href={`/categories/${category.handle}`}
              className="group block"
            >
              <Thumbnail
                thumbnail={cover!.thumbnail}
                images={cover!.images}
                size="full"
              />
              <span className="label-type mt-4 block border-t border-rule pt-3 text-ink">
                {category.name}
              </span>
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
