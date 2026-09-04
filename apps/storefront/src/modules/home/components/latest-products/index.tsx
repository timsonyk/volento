import { listModelColors, listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
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
    <section id="novinki" className="py-14 small:py-20">
      <div className="content-container mb-11">
        <h2 className="text-base text-ink">Новинки</h2>
      </div>

      {/* Лента во всю ширину: слева выравнена по общему контейнеру,
          справа уходит за край экрана — так видно, что можно листать. */}
      {/* Лента во всю ширину экрана, без полей по краям — как в референсе:
          там контейнер прокрутки равен ширине окна, карточки упираются
          в края. Отступ слева, который был раньше, Тимофей попросил убрать.

          Карточки прилипают при листании (scroll-snap). Ширины сняты
          замерами с референса: на телефоне видно одну карточку с краешком
          следующей (84 % ширины экрана), на планшете около трёх (35 %), на
          компьютере около четырёх. Зазор 6 px. */}
      <ul className="no-scrollbar flex snap-x snap-mandatory gap-x-1.5 overflow-x-auto pb-1">
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
