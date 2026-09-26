import { listCartShippingMethods } from "@lib/data/fulfillment"
import { listCartPaymentMethods } from "@lib/data/payment"
import { HttpTypes } from "@medusajs/types"
import Payment from "@modules/checkout/components/payment"
import CityField from "@modules/checkout/components/city-field"
import Recipient from "@modules/checkout/components/recipient"
import Review from "@modules/checkout/components/review"
import Shipping from "@modules/checkout/components/shipping"
import Шаги from "@modules/checkout/components/steps"

export default async function CheckoutForm({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) {
  if (!cart) {
    return null
  }

  const shippingMethods = await listCartShippingMethods(cart.id)
  const paymentMethods = await listCartPaymentMethods(cart.region?.id ?? "")

  if (!shippingMethods || !paymentMethods) {
    return null
  }

  // Пункты идут по порядку и открываются по одному — этим занимается
  // «Шаги». Сами блоки отрисованы здесь, на сервере, и передаются туда
  // готовыми.
  //
  // Отдельного блока с адресом нет: проверено, что службе достаточно
  // города — цена с одним городом и с полным адресом совпадает. Улицу
  // будем спрашивать только у тех, кто выберет курьера.
  //
  // Порядок: город, доставка, получатель. Телефон для расчёта не нужен
  // (тоже проверено), поэтому контакты можно спрашивать после того, как
  // человек увидел цены и сроки.
  return (
    <Шаги
      cart={cart}
      город={<CityField cart={cart} />}
      доставка={
        <Shipping cart={cart} availableShippingMethods={shippingMethods} />
      }
      получатель={<Recipient cart={cart} />}
      оплата={
        <Payment cart={cart} availablePaymentMethods={paymentMethods} />
      }
      проверка={<Review cart={cart} />}
    />
  )
}
