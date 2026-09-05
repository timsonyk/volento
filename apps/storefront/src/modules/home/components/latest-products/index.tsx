import { listModelColors, listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import ProductPreview from "@modules/products/components/product-preview"

/**
 * Лента товаров: карточки уходят за правый край и прокручиваются вбок,
 * как на референсе. Цвета моделей берутся одним запросом на всю ленту,
 * а не по запросу на карточку.
 *
 * На главной таких лент две — до и после широкого баннера, как у
 * референса. Отличаются заголовком и порядком выборки.
 */
export default async function LatestProducts({
  region,
  countryCode,
  title = "Новинки",
  anchor = "novinki",
  order = "-created_at",
}: {
  region: HttpTypes.StoreRegion
  countryCode: string
  title?: string
  anchor?: string
  order?: string
}) {
  const {
    response: { products },
  } = await listProducts({
    regionId: region.id,
    queryParams: {
      limit: 12,
      order,
      fields: "*variants.calculated_price,+metadata,+tags",
    },
  })

  if (!products?.length) {
    return null
  }

  const colorsByModel = await listModelColors({ products, countryCode })

  // Вертикальный воздух по замерам референса: над заголовком 50 px,
  // от заголовка до карточек 15 на телефоне и 31 дальше, под лентой
  // 82 и 108. Между секциями у них ноль — блоки стоят вплотную.
  return (
    <section id={anchor} className="pt-[50px] pb-4 small:pb-10">
      <div className="mb-4 px-4 small:mb-8 xsmall:px-[30px] small:px-[50px]">
        <h2 className="text-base text-ink">{title}</h2>
      </div>

      {/* Лента во всю ширину: слева выравнена по общему контейнеру,
          справа уходит за край экрана — так видно, что можно листать. */}
      {/* Замеры референса: отступ от края 16 px на телефоне, 30 на планшете,
          50 на компьютере; зазор 6 px; карточка 84 / 35 / 26 % ширины экрана,
          то есть видно 1,2 / 2,8 / 3,8 штуки — краешек следующей и
          подсказывает, что ленту можно листать.

          Карточки прилипают при листании. scroll-pl повторяет отступ, иначе
          прилипание подтягивает первую карточку вплотную к краю. */}
      <ul className="no-scrollbar flex snap-x snap-mandatory gap-x-1.5 overflow-x-auto scroll-pl-4 px-4 pb-1 xsmall:scroll-pl-[30px] xsmall:px-[30px] small:scroll-pl-[50px] small:px-[50px]">
        {products.map((product) => (
          <li
            key={product.id}
            className="w-[84vw] shrink-0 snap-start xsmall:w-[35vw] small:w-[26vw]"
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
