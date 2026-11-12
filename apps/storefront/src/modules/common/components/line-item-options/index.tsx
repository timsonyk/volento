import { HttpTypes } from "@medusajs/types"
import { Text } from "@modules/common/components/ui"

type LineItemOptionsProps = {
  variant: HttpTypes.StoreProductVariant | undefined
  "data-testid"?: string
  "data-value"?: HttpTypes.StoreProductVariant
}

/**
 * Название варианта у нас — «46 / 170» (размер и рост) или просто «42».
 * Покупателю пишем словами: «Размер 46, рост 170». Прочее («Один») —
 * как есть.
 */
export const подписьВарианта = (title?: string | null): string => {
  const чистый = String(title ?? "").trim()
  const м = /^(\S+)\s*\/\s*(1[5-9]\d)$/.exec(чистый)
  if (м) {
    return `Размер ${м[1]}, рост ${м[2]}`
  }
  return /^\d/.test(чистый) ? `Размер ${чистый}` : чистый
}

const LineItemOptions = ({
  variant,
  "data-testid": dataTestid,
  "data-value": dataValue,
}: LineItemOptionsProps) => {
  const подпись = подписьВарианта(variant?.title)

  if (!подпись) {
    return null
  }

  return (
    <Text
      data-testid={dataTestid}
      data-value={dataValue}
      className="inline-block txt-medium text-ui-fg-subtle w-full overflow-hidden text-ellipsis"
    >
      {подпись}
    </Text>
  )
}

export default LineItemOptions
