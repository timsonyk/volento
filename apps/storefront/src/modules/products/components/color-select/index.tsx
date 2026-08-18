import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { clx } from "@modules/common/components/ui"

type ColorSelectProps = {
  product: HttpTypes.StoreProduct
  countryCode: string
}

/**
 * Переключатель цвета внутри карточки товара.
 *
 * Цвет у нас не опция варианта, а отдельный товар: у каждого цвета свой
 * артикул и своя съёмка. Товары одной модели связаны меткой model:<код>,
 * по ней тут и собираются остальные цвета.
 */
const ColorSelect = async ({ product, countryCode }: ColorSelectProps) => {
  const modelTag = product.tags?.find((t) => t.value?.startsWith("model:"))

  if (!modelTag?.id) {
    return null
  }

  const { response } = await listProducts({
    countryCode,
    queryParams: { tag_id: [modelTag.id], limit: 20 } as any,
  })

  const colors = response.products.filter((p) => p.metadata?.color)

  // один цвет — переключать нечего
  if (colors.length < 2) {
    return null
  }

  const currentColor = product.metadata?.color as string | undefined

  return (
    <div className="flex flex-col gap-y-3">
      <span className="text-sm">
        Цвет{currentColor ? `: ${currentColor.toLowerCase()}` : ""}
      </span>
      <div className="flex flex-wrap gap-3" data-testid="product-colors">
        {colors.map((c) => {
          const isCurrent = c.id === product.id
          const name = (c.metadata?.color as string) ?? ""

          return (
            <LocalizedClientLink
              key={c.id}
              href={`/products/${c.handle}`}
              title={name}
              aria-label={`Цвет: ${name}`}
              aria-current={isCurrent ? "true" : undefined}
              data-testid="color-option"
              className={clx(
                "h-8 w-8 rounded-full border",
                isCurrent
                  ? "border-ui-border-interactive ring-1 ring-ui-border-interactive"
                  : "border-ui-border-base hover:shadow-elevation-card-rest transition-shadow ease-in-out duration-150"
              )}
              style={{
                backgroundColor: (c.metadata?.color_hex as string) || "#e5e5e5",
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

export default ColorSelect
