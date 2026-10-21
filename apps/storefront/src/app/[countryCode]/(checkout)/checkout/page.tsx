import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import ПривязкаКорзины from "@modules/checkout/components/privyazka-korziny"
import ВходДляЗаказа from "@modules/checkout/components/vhod-dlya-zakaza"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Оформление заказа",
}

export default async function Checkout() {
  const cart = await retrieveCart()

  if (!cart) {
    return notFound()
  }

  const customer = await retrieveCustomer()

  // Заказ оформляет только вошедший покупатель: у заказа должен быть
  // кабинет — там трек и кнопка возврата. Сервер проверяет то же самое
  // (backend/src/lib/tolko-pokupatel.ts), здесь — чтобы человек понял, что
  // делать.
  const форма = !customer ? (
    <ВходДляЗаказа />
  ) : cart.customer_id !== customer.id ? (
    <ПривязкаКорзины />
  ) : (
    <PaymentWrapper cart={cart}>
      <CheckoutForm cart={cart} customer={customer} />
    </PaymentWrapper>
  )

  return (
    <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] content-container gap-x-40 py-12">
      {форма}
      <CheckoutSummary cart={cart} />
    </div>
  )
}
