import { getHomeContent, ключПлитки } from "@lib/data/home-banner"
import { listCategories } from "@lib/data/categories"
import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Плитки разделов с подписью над фотографией. На телефоне это листалка —
 * одна плитка на 88 % ширины и краешек следующей, зазор 16 px; на
 * компьютере четыре в ряд встык, без полей. Кадр 2:3.
 *
 * Разделы выбраны на встрече 23 октября: женские брюки, юбки, рубашки,
 * мужские брюки — мужское с женским не смешиваем, блузок на главной нет
 * (в каталоге они остаются). Подпись над фото, а не под: иначе, долистав
 * до плиток, непонятно, что это уже разделы, а не товары. Подпись своя,
 * а не из каталога: «Брюки» в каталоге — это женские брюки.
 *
 * Обложка берётся из записи «Оформление сайта» по ключу раздела. Если
 * своей картинки нет, показывается фотография товара из раздела — живая
 * вещь лучше заглушки. Раздел без обеих не показывается вовсе.
 */
const ПЛИТКИ = [
  { handle: "bryuki", подпись: "Женские брюки" },
  { handle: "yubki", подпись: "Юбки" },
  { handle: "rubashki", подпись: "Рубашки" },
  { handle: "muzhskie-bryuki", подпись: "Мужские брюки" },
]
export default async function CategoryTiles({
  region,
  countryCode,
}: {
  region: HttpTypes.StoreRegion
  countryCode: string
}) {
  const [categories, { картинка }] = await Promise.all([
    listCategories(),
    getHomeContent(countryCode),
  ])
  const поАдресу = new Map((categories ?? []).map((c) => [c.handle, c]))
  const выбранные = ПЛИТКИ.flatMap((п) => {
    const c = поАдресу.get(п.handle)
    return c ? [{ ...c, name: п.подпись }] : []
  })

  if (!выбранные.length) {
    return null
  }

  const tiles = await Promise.all(
    выбранные.map(async (c) => {
      const своя = картинка(ключПлитки(c.handle))
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

  const колонок =
    filled.length >= 4
      ? "small:grid-cols-4"
      : filled.length === 3
        ? "small:grid-cols-3"
        : "small:grid-cols-2"

  return (
    <section id="siluety" className="pb-3 small:pb-12">
      {/* Колонок ровно столько, сколько плиток, но не больше четырёх:
          при жёстких трёх колонках четвёртый раздел оставался один в
          нижнем ряду и вся сетка выглядела развалившейся. */}
      <ul
        className={`no-scrollbar flex snap-x snap-mandatory gap-x-4 overflow-x-auto scroll-pl-4 px-4 small:grid small:gap-x-0 small:overflow-visible small:px-0 ${колонок}`}
      >
        {filled.map(({ category, обложка }) => (
          <li key={category.id} className="w-[88vw] shrink-0 snap-start small:w-auto">
            <LocalizedClientLink
              href={`/categories/${category.handle}`}
              className="group block"
            >
              <span className="mb-3 block text-center text-xl text-ink xsmall:text-2xl small:mb-4">
                {category.name}
              </span>
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-mist">
                <Image
                  src={обложка!}
                  alt={category.name}
                  fill
                  sizes="(max-width: 1024px) 88vw, 25vw"
                  quality={80}
                  className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </div>
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
