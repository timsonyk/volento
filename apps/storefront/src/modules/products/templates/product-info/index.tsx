import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

/** Цвет показан отдельным переключателем — в заголовке он лишний. */
function stripColor(title: string, color?: string) {
  if (!color) {
    return title
  }
  const suffix = `, ${color.toLowerCase()}`
  return title.toLowerCase().endsWith(suffix)
    ? title.slice(0, -suffix.length)
    : title
}

const ProductInfo = ({ product }: ProductInfoProps) => {
  const color = product.metadata?.color as string | undefined
  const article = product.metadata?.article as string | undefined

  return (
    <div id="product-info">
      <div className="mx-auto flex flex-col lg:max-w-[500px]">
        {product.collection && (
          <LocalizedClientLink
            href={`/collections/${product.collection.handle}`}
            className="label-type mb-4 text-muted hover:text-ink"
          >
            {product.collection.title}
          </LocalizedClientLink>
        )}

        <h1
          className="font-display text-[2rem] leading-[1.15] text-ink"
          data-testid="product-title"
        >
          {stripColor(product.title, color)}
        </h1>

        {article && (
          <span className="label-type mt-4 text-muted">Артикул {article}</span>
        )}

        {product.description && (
          <p
            className="mt-6 whitespace-pre-line text-sm leading-relaxed text-muted"
            data-testid="product-description"
          >
            {product.description}
          </p>
        )}
      </div>
    </div>
  )
}

export default ProductInfo
