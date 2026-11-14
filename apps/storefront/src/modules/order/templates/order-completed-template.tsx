import { Heading, Text } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartTotals from "@modules/common/components/cart-totals"
import Help from "@modules/order/components/help"
import Items from "@modules/order/components/items"
import OrderDetails from "@modules/order/components/order-details"
import ShippingDetails from "@modules/order/components/shipping-details"
import PaymentDetails from "@modules/order/components/payment-details"
import { HttpTypes } from "@medusajs/types"

type OrderCompletedTemplateProps = {
  order: HttpTypes.StoreOrder
}

export default async function OrderCompletedTemplate({
  order,
}: OrderCompletedTemplateProps) {
  return (
    <div className="py-6 min-h-[calc(100vh-64px)]">
      <div className="content-container flex flex-col justify-center items-center gap-y-10 max-w-4xl h-full w-full">
        <div
          className="flex flex-col gap-4 max-w-4xl h-full bg-white w-full py-10"
          data-testid="order-complete-container"
        >
          <Heading
            level="h1"
            className="flex flex-col gap-y-3 text-ui-fg-base text-3xl mb-4"
          >
            <span>Спасибо!</span>
            <span>Ваш заказ успешно оформлен.</span>
          </Heading>
          <OrderDetails order={order} />
          <div className="flex flex-col gap-y-3" data-testid="chto-dalshe">
            <Text>
              Мы соберём заказ и передадим в доставку. Когда он уедет, пришлём
              письмо с номером для отслеживания. Следить за заказом и
              оформить возврат можно в личном кабинете.
            </Text>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <LocalizedClientLink
                href={`/account/orders/details/${order.id}`}
                className="underline underline-offset-4"
                data-testid="zakaz-v-kabinete"
              >
                Открыть заказ в кабинете
              </LocalizedClientLink>
              <LocalizedClientLink
                href="/store"
                className="underline underline-offset-4"
              >
                Вернуться в каталог
              </LocalizedClientLink>
            </div>
          </div>
          <Heading level="h2" className="flex flex-row text-3xl-regular">
            Ваш заказ
          </Heading>
          <Items order={order} />
          <CartTotals totals={order} />
          <ShippingDetails order={order} />
          <PaymentDetails order={order} />
          <Help />
        </div>
      </div>
    </div>
  )
}
