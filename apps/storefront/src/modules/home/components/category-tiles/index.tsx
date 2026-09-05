import { getHomeImages } from "@lib/data/home-banner"
import { listCategories } from "@lib/data/categories"
import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Плитки разделов с подписями под ними. По замерам референса: на телефоне
 * это листалка — одна плитка на 88 % ширины и краешек следующей, зазор
 * 16 px; на компьютере три в ряд встык, без полей. Кадр 2:3.
 *
 * Обложка берётся из записи «Картинки главной страницы»: шестая картинка
 * идёт первому разделу, седьмая второму и так далее по порядку разделов.
 * Если своей картинки нет, показывается фотография товара из раздела —
 * живая вещь лучше заглушки. Раздел без обеих не показывается вовсе.
 */
export default async function CategoryTiles({
  region,
  countryCode,
}: {
  region: HttpTypes.StoreRegion
  countryCode: string
}) {
  const [categories, картинки] = await Promise.all([
    listCategories(),
    getHomeImages(countryCode),
  ])
  const top = (categories ?? []).filter((c) => !c.parent_category)

  if (!top.length) {
    return null
  }

  // картинки разделов идут с шестой по счёту, по порядку самих разделов
  const ПЕРВАЯ_ПЛИТКА = 5

  const tiles = await Promise.all(
    top.map(async (c, n) => {
      const своя = картинки[ПЕРВАЯ_ПЛИТКА + n]
      if (своя) {
        return { category: c, обложка: своя }
      }
      const {
        response: { products },
      } = await listProducts({
        regionId: region.id,
        queryParams: { limit: 1, category_id: [c.id] } as any,
      })
      return { category: c, обложка: products?.[0]?.thumbnail ?? undefined }
    })
  )

  const filled = tiles.filter((t) => t.обложка)

  if (!filled.length) {
    return null
  }

  return (
    <section id="siluety" className="pb-3 small:pb-12">
      <ul className="no-scrollbar flex snap-x snap-mandatory gap-x-4 overflow-x-auto scroll-pl-4 px-4 small:grid small:grid-cols-3 small:gap-x-0 small:overflow-visible small:px-0">
        {filled.map(({ category, обложка }) => (
          <li key={category.id} className="w-[88vw] shrink-0 snap-start small:w-auto">
            <LocalizedClientLink
              href={`/categories/${category.handle}`}
              className="group block"
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-mist">
                <Image
                  src={обложка!}
                  alt={category.name}
                  fill
                  sizes="(max-width: 1024px) 88vw, 33vw"
                  quality={80}
                  className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </div>
              <span className="mt-4 block text-center text-xl text-ink xsmall:text-2xl">
                {category.name}
              </span>
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
