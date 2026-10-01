import Image from "next/image"

import { getHomeContent } from "@lib/data/home-banner"
import { listModelColors, listProducts } from "@lib/data/products"
import { новыеВНаличии } from "@lib/data/facets"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreview from "@modules/products/components/product-preview"

/**
 * Блок между категориями и низом главной. По замерам референса:
 *   телефон    — квадратная картинка во всю ширину, под ней ряд из двух
 *                карточек, зазор 15 px;
 *   компьютер  — картинка занимает левую половину, справа те же две
 *                карточки. Высоту левой половины задаёт правая: картинка
 *                тянется вровень с карточками вместе с их подписями
 *                (у них 720x590 при ширине окна 1440).
 *
 * Картинка берётся по ключу «середина». Исходник квадратный: на
 * компьютере он обрезается сверху и снизу.
 */
const FALLBACK = "/hero.webp"

export default async function FeatureBlock({
  region,
  countryCode,
}: {
  region: HttpTypes.StoreRegion
  countryCode: string
}) {
  // Две самые новые модели в наличии — из лёгкой выписки, без служебных
  // записей: раньше «Оформление сайта» съедала половину блока
  const [{ картинка }, иды] = await Promise.all([
    getHomeContent(countryCode),
    новыеВНаличии(2),
  ])

  const { response } =
    иды.length === 2
      ? await listProducts({
          regionId: region.id,
          queryParams: {
            id: иды,
            limit: 2,
            fields: "*variants.calculated_price,+metadata,+tags",
          },
        })
      : { response: { products: [] } }

  const products = response.products ?? []

  // вторая карточка обязательна: одна оставляла половину блока пустой
  if (products.length < 2) {
    return null
  }

  const colorsByModel = await listModelColors({ products, countryCode })

  return (
    <section id="podborka" className="w-full pb-[37px] xsmall:pb-[25px]">
      <div className="xsmall:grid xsmall:grid-cols-2 xsmall:gap-x-[5px]">
        <LocalizedClientLink
          href="/store"
          className="relative block aspect-square w-full overflow-hidden bg-mist xsmall:aspect-auto xsmall:h-full"
        >
          <Image
            src={картинка("середина") ?? FALLBACK}
            alt="Классические брюки Volento"
            fill
            sizes="(max-width: 512px) 100vw, 50vw"
            quality={85}
            className="object-cover object-center"
          />
        </LocalizedClientLink>

        <ul className="mt-[15px] grid grid-cols-2 gap-x-1.5 xsmall:mt-0 xsmall:gap-x-1">
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
      </div>
    </section>
  )
}
