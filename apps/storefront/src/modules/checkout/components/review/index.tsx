"use client"

import { useState } from "react"

import { Heading, clx } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import PaymentButton from "../payment-button"
import { HttpTypes } from "@medusajs/types"

/**
 * Проверка заказа и согласие на обработку персональных данных.
 *
 * Галочка обязательно снята по умолчанию и отделена от кнопки: согласие,
 * поставленное за покупателя заранее, Роскомнадзор согласием не считает.
 * Пока не отмечена — кнопку оформления не даём нажать.
 */
const Review = ({ cart }: { cart: HttpTypes.StoreCart }) => {
  const [согласен, setСогласен] = useState(false)

  // Раздел всегда открыт: оформление одностраничное.
  const isOpen = true

  const paidByGiftcard = !!(
    (cart as unknown as Record<string, unknown>)?.gift_cards &&
    ((cart as unknown as Record<string, unknown>)?.gift_cards as unknown[])
      ?.length > 0 &&
    cart?.total === 0
  )

  const previousStepsCompleted =
    cart.shipping_address &&
    (cart.shipping_methods?.length ?? 0) > 0 &&
    (cart.payment_collection || paidByGiftcard)

  return (
    <div className="bg-white">
      <div className="mb-6 flex flex-row items-center justify-between">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row items-baseline gap-x-2 text-3xl-regular",
            {
              "pointer-events-none select-none opacity-50": !isOpen,
            }
          )}
        >
          Проверка заказа
        </Heading>
      </div>

      {isOpen && previousStepsCompleted && (
        <>
          <label className="mb-6 flex cursor-pointer items-start gap-x-3">
            <input
              type="checkbox"
              checked={согласен}
              onChange={(e) => setСогласен(e.target.checked)}
              className="mt-[3px] h-4 w-4 shrink-0 accent-ink"
              data-testid="consent-checkbox"
            />
            <span className="text-sm leading-relaxed text-ink">
              Я согласен на обработку моих персональных данных в соответствии
              с{" "}
              <LocalizedClientLink href="/politika" className="underline">
                политикой конфиденциальности
              </LocalizedClientLink>{" "}
              и принимаю условия{" "}
              <LocalizedClientLink href="/oferta" className="underline">
                публичной оферты
              </LocalizedClientLink>{" "}
              и{" "}
              <LocalizedClientLink href="/soglashenie" className="underline">
                пользовательского соглашения
              </LocalizedClientLink>
              .
            </span>
          </label>

          <PaymentButton
            cart={cart}
            blocked={!согласен}
            data-testid="submit-order-button"
          />

          {!согласен && (
            <p
              className="mt-3 text-sm text-muted"
              data-testid="consent-hint"
            >
              Чтобы оформить заказ, отметьте согласие выше.
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default Review
