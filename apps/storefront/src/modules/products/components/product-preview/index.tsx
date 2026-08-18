import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"

/**
 * Название товара приходит с цветом в конце («…, чёрный»), а цвет мы
 * показываем отдельной строкой. Убираем повтор, если он есть.
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

export default async function ProductPreview({
  product,
  isFeatured,
  region: _region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  const { cheapestPrice } = getProductPrice({ product })
  const color = product.metadata?.color as string | undefined

  return (
    <LocalizedClientLink
      href={`/products/${product.handle}`}
      className="group block"
    >
      <div data-testid="product-wrapper">
        <Thumbnail
          thumbnail={product.thumbnail}
          images={product.images}
          size="full"
          isFeatured={isFeatured}
        />

        <div className="mt-4 flex items-baseline justify-between gap-x-4 border-t border-rule pt-3">
          <h3
            className="text-sm leading-snug text-ink"
            data-testid="product-title"
          >
            {stripColor(product.title, color)}
          </h3>
          {cheapestPrice && (
            <div className="shrink-0 text-sm text-ink">
              <PreviewPrice price={cheapestPrice} />
            </div>
          )}
        </div>

        {color && (
          <span className="label-type mt-2 block text-muted">{color}</span>
        )}
      </div>
    </LocalizedClientLink>
  )
}
