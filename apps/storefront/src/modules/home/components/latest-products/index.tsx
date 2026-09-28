import { listModelColors, listProducts } from "@lib/data/products"
import SectionHeading from "@modules/home/components/section-heading"
import { HttpTypes } from "@medusajs/types"
import ProductPreview from "@modules/products/components/product-preview"
import ScrollRow from "@modules/common/components/scroll-row"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Лента товаров: карточки уходят за правый край и прокручиваются вбок,
 * как на референсе. Цвета моделей берутся одним запросом на всю ленту,
 * а не по запросу на карточку.
 *
 * На главной таких лент две — до и после широкого баннера, как у
 * референса. Отличаются заголовком и порядком выборки.
 */
/** Сезон прописью — подпись над заголовком, как на референсе. */
function сезон(дата = new Date()): string {
  const м = дата.getMonth()
  const г = дата.getFullYear()
  if (м <= 1 || м === 11) {
    // Зима переходит через новый год: декабрь относим к следующему.
    return `Зима ${м === 11 ? `${г}/${г + 1}` : `${г - 1}/${г}`}`
  }
  if (м <= 4) return `Весна ${г}`
  if (м <= 7) return `Лето ${г}`
  return `Осень ${г}`
}

export default async function LatestProducts({
  region,
  countryCode,
  title = "Новинки",
  anchor = "novinki",
  order = "-created_at",
  надпись,
  ссылка = "/store",
}: {
  region: HttpTypes.StoreRegion
  countryCode: string
  title?: string
  anchor?: string
  order?: string
  надпись?: string
  ссылка?: string
}) {
  const {
    response: { products },
  } = await listProducts({
    regionId: region.id,
    queryParams: {
      limit: 12,
      order,
      // Размеры и остатки нужны строке размеров, которая показывается
      // при наведении на карточку.
      fields:
        "*variants.calculated_price,*variants.options,+variants.inventory_quantity,+metadata,+tags",
    },
  })

  if (!products?.length) {
    return null
  }

  const colorsByModel = await listModelColors({ products, countryCode })

  // Вертикальный воздух по замерам референса: над заголовком было 50 px,
  // сейчас 42 — заголовок попросили поднять на пару пикселей выше,
  // от заголовка до карточек 15 на телефоне и 31 дальше, под лентой
  // 82 и 108. Между секциями у них ноль — блоки стоят вплотную.
  return (
    <section id={anchor} className="pt-[42px] pb-4 small:pb-10">
      {/* На широком экране подпись, заголовок и ссылка стоят слева от
          ленты — так же, как на референсе. На телефоне колонка съела бы
          пол-экрана, поэтому там заголовок остаётся над лентой. */}
      <div className="small:flex small:items-start">
        <div className="mb-4 px-4 small:mb-0 small:w-[22vw] small:shrink-0 small:px-0 small:pl-[50px] small:pr-6 xsmall:px-[30px] small:pt-1">
          <p className="mb-1 text-sm text-muted small:mb-2">
            {надпись ?? сезон()}
          </p>
          <SectionHeading>{title}</SectionHeading>
          <LocalizedClientLink
            href={ссылка}
            className="mt-2 inline-block text-sm text-ink underline underline-offset-4 decoration-rule transition-colors hover:decoration-ink small:mt-3"
          >
            Смотреть все
          </LocalizedClientLink>
        </div>

        {/* Лента уходит за правый край экрана — так видно, что её можно
            листать. Слева на широком экране она начинается от текстовой
            колонки, на узком — от общего отступа страницы. */}
        <ScrollRow
          ariaLabel={title}
          // Растягивается рамка, а не список: к рамке привязаны стрелки,
          // и от её ширины зависит, есть ли что прокручивать.
          обёртка="small:min-w-0 small:flex-1"
          className="no-scrollbar flex snap-x snap-mandatory gap-x-1.5 overflow-x-auto scroll-pl-4 px-4 pb-1 xsmall:scroll-pl-[30px] xsmall:px-[30px] small:scroll-pl-0 small:px-0"
        >
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
        </ScrollRow>
      </div>
    </section>
  )
}
