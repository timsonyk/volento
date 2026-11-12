import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { Heading, Text } from "@modules/common/components/ui"

import Divider from "@modules/common/components/divider"

type ShippingDetailsProps = {
  order: HttpTypes.StoreOrder
}

const ShippingDetails = ({ order }: ShippingDetailsProps) => {
  const адрес = order.shipping_address
  // пустые части не оставляют после себя запятых и пробелов
  const строка = (...части: (string | null | undefined)[]) =>
    части.map((ч) => String(ч ?? "").trim()).filter(Boolean)

  return (
    <div>
      <Heading level="h2" className="flex flex-row text-3xl-regular my-6">
        Доставка
      </Heading>
      {/* на телефоне — друг под другом: в три узких столбца почта не
          помещалась и наезжала на соседний */}
      <div className="flex flex-col gap-y-6 small:flex-row small:items-start small:gap-x-8">
        <div
          className="flex flex-col small:w-1/3"
          data-testid="shipping-address-summary"
        >
          <Text className="txt-medium-plus text-ui-fg-base mb-1">
            Адрес доставки
          </Text>
          <Text className="txt-medium text-ui-fg-subtle">
            {строка(адрес?.first_name, адрес?.last_name).join(" ")}
          </Text>
          <Text className="txt-medium text-ui-fg-subtle">
            {строка(адрес?.postal_code, адрес?.city, адрес?.address_1, адрес?.address_2).join(", ")}
          </Text>
        </div>
        <div
          className="flex flex-col small:w-1/3"
          data-testid="shipping-contact-summary"
        >
          <Text className="txt-medium-plus text-ui-fg-base mb-1">Контакты</Text>
          <Text className="txt-medium text-ui-fg-subtle">{адрес?.phone}</Text>
          <Text className="txt-medium text-ui-fg-subtle break-words">
            {order.email}
          </Text>
        </div>
        <div
          className="flex flex-col small:w-1/3"
          data-testid="shipping-method-summary"
        >
          <Text className="txt-medium-plus text-ui-fg-base mb-1">
            Способ доставки
          </Text>
          <Text className="txt-medium text-ui-fg-subtle">
            {(order.shipping_methods?.[0] as { name?: string })?.name} (
            {convertToLocale({
              amount: order.shipping_methods?.[0].total ?? 0,
              currency_code: order.currency_code,
            })}
            )
          </Text>
        </div>
      </div>
      <Divider className="mt-8" />
    </div>
  )
}

export default ShippingDetails
