import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { ModelColor } from "types/global"
import PreviewGallery from "./gallery"
import PreviewPrice from "./price"
import PreviewSizes, { размерыТовара } from "./sizes"

/**
 * Название приходит с цветом в конце («…, чёрный»), а цвет показан
 * кружками — убираем повтор.
 */
function stripColor(title: string, color?: string) {
  if (!color) {
    return title
  }
  const suffix = `, ${color.toLowerCase()}`
  return title.toLowerCase().endsWith(suffix)
    ? title.slice(0, -suffix.length)
    : title
}

/**
 * Не async намеренно: внутри нечего ждать, а так карточку можно рисовать
 * и на сервере, и в браузере — это нужно кнопке «Показать ещё».
 */
export default function ProductPreview({
  product,
  isFeatured,
  colors,
  region: _region,
  sizes,
}: {
  /** ширина карточки на экране, см. gallery.tsx */
  sizes?: string
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  colors?: ModelColor[]
  region: HttpTypes.StoreRegion
}) {
  const { cheapestPrice } = getProductPrice({ product })

  // первым идёт обложечный снимок, дальше остальные без повторов
  const photos = Array.from(
    new Set(
      [product.thumbnail, ...(product.images ?? []).map((i) => i.url)].filter(
        Boolean
      ) as string[]
    )
  )
  const color = product.metadata?.color as string | undefined

  // кружки внутри ссылки на карточку — только показывают, какие цвета есть
  const swatches = (colors ?? []).length > 1 ? colors! : []

  // На телефоне карточка узкая: у модели бывает девять цветов, и ряд
  // кружков выдавливал сам себя за край экрана. Показываем четыре, дальше
  // счётчик — все цвета всё равно видны в самой карточке товара.
  // Размеры показываем при наведении вместо кружков цвета: строка одна,
  // и держать в ней два ряда значков тесно. На телефоне наведения нет,
  // поэтому там всегда видны цвета.
  const размеры = размерыТовара(product)

  const СКОЛЬКО_КРУЖКОВ = 4
  const видимые = swatches.slice(0, СКОЛЬКО_КРУЖКОВ)
  const остальные = swatches.length - видимые.length

  return (
    <LocalizedClientLink
      href={`/products/${product.handle}`}
      className="group block h-full"
    >
      <div className="flex h-full flex-col" data-testid="product-wrapper">
        <PreviewGallery
          images={photos}
          alt={stripColor(product.title, color)}
          sizes={sizes}
        />

        {/* Текст под фото по замерам референса: на телефоне 12 px с
            межстрочным 1.2 и отступом 11 от фото, от планшета 14 px с 1.4
            и отступом 10; цена сразу под названием, без зазора.
            Подпись сдвинута от края фото: 13 px на телефоне, 21 дальше.
            Кегль поднят против замеров по просьбе. */}
        <h3
          // без минимальной высоты: она оставляла дыру под короткими
          // названиями. Цены выравнивает mt-auto ниже — он прижимает
          // строку с ценой к низу карточки
          // От 1280 px карточек в каталоге пять в ряд — подпись мельче и
          // ближе к краю, иначе название занимало пол-карточки
          className="mt-[11px] line-clamp-2 pl-[13px] text-sm leading-[1.2] text-ink xsmall:mt-2.5 xsmall:pl-[21px] xsmall:text-base xsmall:leading-[1.4] medium:pl-3 medium:text-[15px] medium:leading-[1.35]"
          data-testid="product-title"
        >
          {stripColor(product.title, color)}
        </h3>

        <div className="mt-auto flex items-center justify-between gap-x-3 pt-1 pl-[13px] text-sm leading-[1.2] xsmall:pl-[21px] xsmall:text-base xsmall:leading-[1.4] medium:pl-3 medium:text-[15px]">
          {cheapestPrice && (
            <div className="flex shrink-0 gap-x-2">
              <PreviewPrice price={cheapestPrice} />
            </div>
          )}

          {размеры.length > 0 && (
            <span className="hidden xsmall:group-hover:flex">
              <PreviewSizes sizes={размеры} />
            </span>
          )}

          {swatches.length > 0 && (
            <div
              // без overflow-hidden: обводка выбранного кружка рисуется
              // за его границей, и обрезка съедала её с четырёх сторон.
              // Переполнения не будет — кружков не больше четырёх
              className={`flex min-w-0 items-center gap-x-1.5 py-0.5${
                размеры.length ? " xsmall:group-hover:hidden" : ""
              }`}
              data-testid="preview-colors"
            >
              {видимые.map((c) => (
                <span
                  key={c.id}
                  title={c.color}
                  aria-hidden
                  className={
                    c.id === product.id
                      ? "h-3 w-3 shrink-0 rounded-full border border-paper ring-1 ring-ink"
                      : "h-3 w-3 shrink-0 rounded-full border border-rule"
                  }
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              {остальные > 0 && (
                <span aria-hidden className="shrink-0 text-xs text-muted">
                  +{остальные}
                </span>
              )}
              <span className="sr-only">
                Цвета модели: {swatches.map((c) => c.color).join(", ")}
              </span>
            </div>
          )}
        </div>
      </div>
    </LocalizedClientLink>
  )
}
