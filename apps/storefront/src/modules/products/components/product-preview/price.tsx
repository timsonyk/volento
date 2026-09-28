import { clx } from "@modules/common/components/ui"
import { VariantPrice } from "types/global"

/**
 * Цена в карточке. Размер шрифта задаёт родитель — здесь только цвет:
 * серый #4d4d4d по замерам референса, у скидки — обычная цена зачёркнута.
 */
export default function PreviewPrice({ price }: { price: VariantPrice }) {
  if (!price) {
    return null
  }

  return (
    <>
      {price.price_type === "sale" && (
        <span className="text-[#4D4D4D] line-through" data-testid="original-price">
          {price.original_price}
        </span>
      )}
      <span
        className={clx("text-[#4D4D4D]", { "text-ink": price.price_type === "sale" })}
        data-testid="price"
      >
        {price.calculated_price}
      </span>
    </>
  )
}
