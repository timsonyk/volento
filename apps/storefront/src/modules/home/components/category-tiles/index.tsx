import { listCategories } from "@lib/data/categories"
import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Плитки разделов во всю ширину экрана, встык, с подписями под ними —
 * как на референсе. Обложкой служит фотография товара из раздела:
 * отдельных картинок для категорий пока нет, а заглушка хуже живой вещи.
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

  const filled = tiles.filter((t) => t.cover?.thumbnail)

  if (!filled.length) {
    return null
  }

  return (
    <section id="siluety" className="pb-16 small:pb-24">
      <ul className="grid grid-cols-1 gap-y-8 small:grid-cols-3 small:gap-y-0">
        {filled.map(({ category, cover }) => (
          <li key={category.id}>
            <LocalizedClientLink
              href={`/categories/${category.handle}`}
              className="group block"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-mist">
                <Image
                  src={cover!.thumbnail!}
                  alt={category.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  quality={80}
                  className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </div>
              <span className="mt-4 block text-center text-base text-ink">
                {category.name}
              </span>
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
