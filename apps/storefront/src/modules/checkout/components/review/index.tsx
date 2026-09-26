"use client"

import { useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

import PaymentButton from "../payment-button"
import { HttpTypes } from "@medusajs/types"

/**
 * Проверка заказа и согласие на обработку персональных данных.
 *
 * Галочка обязательно снята по умолчанию и отделена от кнопки: согласие,
 * поставленное за покупателя заранее, Роскомнадзор согласием не считает.
 * Пока не отмечена — кнопку оформления не даём нажать.
 *
 * До этого пункта доходят, только пройдя все предыдущие: за порядком
 * следит обёртка «Шаг», здесь проверять нечего.
 */
const Review = ({ cart }: { cart: HttpTypes.StoreCart }) => {
  const [согласен, setСогласен] = useState(false)

  return (
    <div className="bg-white">
      {/* Заголовок пункта рисует обёртка «Шаг» — здесь он был бы вторым. */}
      <label className="mb-6 flex cursor-pointer items-start gap-x-3">
        <input
          type="checkbox"
          checked={согласен}
          onChange={(e) => setСогласен(e.target.checked)}
          className="mt-[3px] h-4 w-4 shrink-0 accent-ink"
          data-testid="consent-checkbox"
        />
        <span className="text-sm leading-relaxed text-ink">
          Я согласен на обработку моих персональных данных в соответствии с{" "}
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
        <p className="mt-3 text-sm text-muted" data-testid="consent-hint">
          Чтобы оформить заказ, отметьте согласие выше.
        </p>
      )}
    </div>
  )
}

export default Review
