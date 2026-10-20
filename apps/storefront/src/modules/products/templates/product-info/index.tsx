import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import ProductDescription from "@modules/products/components/product-description"

/** Цвет показан отдельным переключателем — в заголовке он лишний. */
export function stripColor(title: string, color?: string) {
  if (!color) {
    return title
  }
  const suffix = `, ${color.toLowerCase()}`
  return title.toLowerCase().endsWith(suffix)
    ? title.slice(0, -suffix.length)
    : title
}

/**
 * Сведения, которые закон требует показать до покупки одежды: состав,
 * страна производства и уход (правила продажи, постановление 2463).
 * Данные взяты с Озона по артикулу и лежат в метаданных товара: sostav,
 * tkan, strana, uhod — правятся в админке, в карточке товара.
 */
const СВЕДЕНИЯ: [string, string][] = [
  ["sostav", "Состав"],
  ["tkan", "Ткань"],
  ["strana", "Страна производства"],
  ["uhod", "Уход"],
]

/**
 * Название, цена и описание товара — в том же порядке, что на референсе.
 *
 * Цена здесь, а не в блоке с размерами: покупатель должен увидеть её сразу
 * под названием, до всяких выборов. Приставку «от» ставим только если
 * размеры и правда стоят по-разному — иначе она сбивает с толку.
 */
const ProductInfo = ({ product }: { product: HttpTypes.StoreProduct }) => {
  const color = product.metadata?.color as string | undefined
  const article = product.metadata?.article as string | undefined
  const { cheapestPrice } = getProductPrice({ product })
  const сведения = СВЕДЕНИЯ.map(([ключ, подпись]) => [подпись, product.metadata?.[ключ]] as const)
    .filter((с): с is readonly [string, string] => typeof с[1] === "string" && с[1].trim() !== "")

  const цены = (product.variants ?? [])
    .map((v) => v.calculated_price?.calculated_amount)
    .filter((c): c is number => typeof c === "number")
  const ценыРазные = цены.length > 1 && new Set(цены).size > 1

  return (
    <div id="product-info" className="flex flex-col">
      <h1
        className="font-display text-[28px] leading-[1.15] text-ink xsmall:text-[36px]"
        data-testid="product-title"
      >
        {stripColor(product.title, color)}
      </h1>

      {cheapestPrice && (
        <p className="mt-4 text-xl text-ink" data-testid="product-page-price">
          {ценыРазные && "от "}
          {cheapestPrice.calculated_price}
        </p>
      )}

      {product.description && (
        <ProductDescription text={product.description} />
      )}

      {сведения.length > 0 && (
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {сведения.map(([подпись, значение]) => (
            <div key={подпись} className="contents">
              <dt className="text-muted">{подпись}</dt>
              <dd className="text-ink">{значение}</dd>
            </div>
          ))}
        </dl>
      )}

      {article && (
        <span className="mt-5 text-sm text-muted">Артикул {article}</span>
      )}
    </div>
  )
}

export default ProductInfo
