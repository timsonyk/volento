"use client"

import { useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

import PaymentButton from "../payment-button"
import { HttpTypes } from "@medusajs/types"

/**
 * Проверка заказа и две отметки: согласие на обработку персональных
 * данных и принятие оферты.
 *
 * Отметки раздельные: с 1 сентября 2025 года согласие на обработку
 * данных должно быть отдельным документом, его нельзя объединять с
 * офертой или соглашением (ч. 1 ст. 9 152-ФЗ). Текст согласия — на
 * странице /soglasie.
 *
 * Обе галочки сняты по умолчанию: поставленное за покупателя согласие
 * Роскомнадзор согласием не считает. Пока не отмечены обе — кнопку
 * оформления не даём нажать.
 *
 * До этого пункта доходят, только пройдя все предыдущие: за порядком
 * следит обёртка «Шаг», здесь проверять нечего.
 */
const Галочка = ({
  отмечено,
  сменить,
  testId,
  children,
}: {
  отмечено: boolean
  сменить: (v: boolean) => void
  testId: string
  children: React.ReactNode
}) => (
  <label className="mb-4 flex cursor-pointer items-start gap-x-3">
    <input
      type="checkbox"
      checked={отмечено}
      onChange={(e) => сменить(e.target.checked)}
      className="mt-[3px] h-4 w-4 shrink-0 accent-ink"
      data-testid={testId}
    />
    <span className="text-sm leading-relaxed text-ink">{children}</span>
  </label>
)

const Review = ({ cart }: { cart: HttpTypes.StoreCart }) => {
  const [данные, setДанные] = useState(false)
  const [оферта, setОферта] = useState(false)
  const можно = данные && оферта

  return (
    <div className="bg-white">
      {/* Заголовок пункта рисует обёртка «Шаг» — здесь он был бы вторым. */}
      <Галочка отмечено={данные} сменить={setДанные} testId="consent-checkbox">
        Даю{" "}
        <LocalizedClientLink href="/soglasie" className="underline">
          согласие на обработку персональных данных
        </LocalizedClientLink>
      </Галочка>

      <Галочка отмечено={оферта} сменить={setОферта} testId="offer-checkbox">
        Принимаю условия{" "}
        <LocalizedClientLink href="/oferta" className="underline">
          публичной оферты
        </LocalizedClientLink>
        , знаком с{" "}
        <LocalizedClientLink href="/politika" className="underline">
          политикой конфиденциальности
        </LocalizedClientLink>{" "}
        и{" "}
        <LocalizedClientLink href="/soglashenie" className="underline">
          пользовательским соглашением
        </LocalizedClientLink>
      </Галочка>

      <div className="mt-2">
        <PaymentButton
          cart={cart}
          blocked={!можно}
          data-testid="submit-order-button"
        />
      </div>

      {!можно && (
        <p className="mt-3 text-sm text-muted" data-testid="consent-hint">
          Чтобы оформить заказ, отметьте обе галочки выше.
        </p>
      )}
    </div>
  )
}

export default Review
