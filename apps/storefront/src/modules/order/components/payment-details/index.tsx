import { Container, Heading, Text } from "@modules/common/components/ui"

import { isStripeLike, paymentInfoMap } from "@lib/constants"
import Divider from "@modules/common/components/divider"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { CreditCard } from "@medusajs/icons"

type PaymentDetailsProps = {
  order: HttpTypes.StoreOrder
}

const PaymentDetails = ({ order }: PaymentDetailsProps) => {
  const payment = order.payment_collections?.[0].payments?.[0]
  // Незнакомый способ оплаты не должен ронять страницу заказа
  const способ = payment
    ? paymentInfoMap[payment.provider_id] ?? { title: "Оплата онлайн", icon: <CreditCard /> }
    : null

  return (
    <div>
      <Heading level="h2" className="flex flex-row text-3xl-regular my-6">
        Оплата
      </Heading>
      <div>
        {payment && (
          <div className="flex flex-col small:flex-row items-start gap-x-1 gap-y-4 w-full">
            <div className="flex flex-col small:w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Способ оплаты
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method"
              >
                {способ?.title}
              </Text>
            </div>
            <div className="flex flex-col small:w-2/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Детали оплаты
              </Text>
              <div className="flex gap-2 txt-medium text-ui-fg-subtle items-center">
                <Container className="flex items-center h-7 w-fit p-2 bg-ui-button-neutral-hover">
                  {способ?.icon}
                </Container>
                <Text data-testid="payment-amount">
                  {isStripeLike(payment.provider_id) && payment.data?.card_last4
                    ? `**** **** **** ${payment.data.card_last4}`
                    : `${convertToLocale({
                        amount: payment.amount,
                        currency_code: order.currency_code,
                      })} — оплачено ${new Date(
                        payment.created_at ?? ""
                      ).toLocaleString("ru-RU")}`}
                </Text>
              </div>
            </div>
          </div>
        )}
      </div>

      <Divider className="mt-8" />
    </div>
  )
}

export default PaymentDetails
