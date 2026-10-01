"use client"

import { isManual, isStripeLike, isTochka } from "@lib/constants"
import { placeOrder } from "@lib/data/cart"
import { проверитьНаличие, словамиОНехватке } from "@lib/data/nalichie"
import { convertToLocale } from "@lib/util/money"
import { ссылкаНаОплату } from "@lib/data/oplata"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import { useParams } from "next/navigation"
import React, { useState } from "react"
import ErrorMessage from "../error-message"
import { useСпособОплаты } from "../steps/context"

/**
 * Последняя проверка перед тем, как брать деньги.
 *
 * Пока человек заполнял адрес, последнюю пару могли купить на Озоне или
 * Вайлдберризе — склад у нас общий. Вернуть деньги потом хуже, чем
 * честно сказать сейчас, поэтому спрашиваем остаток заново и, если не
 * хватает, до оплаты не пускаем.
 *
 * Возвращает текст отказа или null, если всё на месте.
 */
const мешаетЛиНаличие = async (
  cart: HttpTypes.StoreCart
): Promise<string | null> => {
  const проверка = await проверитьНаличие(cart)

  if (проверка.хватает) {
    return null
  }

  return await словамиОНехватке(проверка.нехватка)
}

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  "data-testid": string
  /** Покупатель не дал согласия на обработку данных — оформлять нельзя. */
  blocked?: boolean
}

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  "data-testid": dataTestId,
  blocked = false,
}) => {
  const notReady =
    blocked ||
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession = cart.payment_collection?.payment_sessions?.[0]
  const [выбранный] = useСпособОплаты()

  switch (true) {
    // У Точки платёжной записи до нажатия нет — смотрим на выбор
    case isTochka(выбранный || paymentSession?.provider_id):
      return (
        <TochkaPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isStripeLike(paymentSession?.provider_id):
      return (
        <StripePaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isManual(paymentSession?.provider_id):
      return (
        <ManualTestPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    default:
      return <Button disabled>Выберите способ оплаты</Button>
  }
}

const StripePaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const stripe = useStripe()
  const elements = useElements()
  const card = elements?.getElement("card")

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

  const disabled = !stripe || !elements ? true : false

  const handlePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)

    if (!stripe || !elements || !card || !cart) {
      setSubmitting(false)
      return
    }

    const мешает = await мешаетЛиНаличие(cart)
    if (мешает) {
      setErrorMessage(мешает)
      setSubmitting(false)
      return
    }

    await stripe
      .confirmCardPayment(session?.data.client_secret as string, {
        payment_method: {
          card: card,
          billing_details: {
            name:
              cart.billing_address?.first_name +
              " " +
              cart.billing_address?.last_name,
            address: {
              city: cart.billing_address?.city ?? undefined,
              country: cart.billing_address?.country_code ?? undefined,
              line1: cart.billing_address?.address_1 ?? undefined,
              line2: cart.billing_address?.address_2 ?? undefined,
              postal_code: cart.billing_address?.postal_code ?? undefined,
              state: cart.billing_address?.province ?? undefined,
            },
            email: cart.email,
            phone: cart.billing_address?.phone ?? undefined,
          },
        },
      })
      .then(({ error, paymentIntent }) => {
        if (error) {
          const pi = error.payment_intent

          if (
            (pi && pi.status === "requires_capture") ||
            (pi && pi.status === "succeeded")
          ) {
            onPaymentCompleted()
          }

          setErrorMessage(error.message || null)
          return
        }

        if (
          (paymentIntent && paymentIntent.status === "requires_capture") ||
          paymentIntent.status === "succeeded"
        ) {
          return onPaymentCompleted()
        }

        return
      })
  }

  return (
    <>
      <Button
        disabled={disabled || notReady}
        onClick={handlePayment}
        size="large"
        isLoading={submitting}
        data-testid={dataTestId}
      >
        Оформить заказ
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="stripe-payment-error-message"
      />
    </>
  )
}

/**
 * Оплата в Точке: проверяем наличие, получаем ссылку и уводим на
 * страницу банка. Заказ появится, когда человек вернётся к нам
 * (страница /checkout/oplata) или когда банк пришлёт уведомление.
 */
const TochkaPaymentButton = ({
  notReady,
  cart,
  "data-testid": dataTestId,
}: {
  notReady: boolean
  cart: HttpTypes.StoreCart
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { countryCode } = useParams() as { countryCode?: string }

  const handlePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)

    const мешает = await мешаетЛиНаличие(cart)
    if (мешает) {
      setErrorMessage(мешает)
      setSubmitting(false)
      return
    }

    const ответ = await ссылкаНаОплату(countryCode || "ru")

    if ("ошибка" in ответ) {
      setErrorMessage(ответ.ошибка)
      setSubmitting(false)
      return
    }

    // Кнопку не отпускаем: страница сейчас сменится на банковскую,
    // а повторное нажатие только создало бы путаницу.
    window.location.href = ответ.ссылка
  }

  return (
    <>
      <Button
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        data-testid={dataTestId}
      >
        Оплатить {сумма(cart)}
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="tochka-payment-error-message"
      />
    </>
  )
}

const сумма = (cart: HttpTypes.StoreCart) =>
  convertToLocale({ amount: cart.total ?? 0, currency_code: cart.currency_code })

const ManualTestPaymentButton = ({
  notReady,
  cart,
}: {
  notReady: boolean
  cart: HttpTypes.StoreCart
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handlePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)

    const мешает = await мешаетЛиНаличие(cart)
    if (мешает) {
      setErrorMessage(мешает)
      setSubmitting(false)
      return
    }

    await onPaymentCompleted()
  }

  return (
    <>
      <Button
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        data-testid="submit-order-button"
      >
        Оформить заказ
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="manual-payment-error-message"
      />
    </>
  )
}

export default PaymentButton
