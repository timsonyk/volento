"use client"

import { useRef, useState } from "react"

import { updateCheckoutFields } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import Input from "@modules/common/components/input"

/**
 * Город доставки — первое, что спрашивают на странице.
 *
 * Заменил собой блок с полным адресом: проверка показала, что службе
 * достаточно города — цена с одним городом и с полным адресом совпадает
 * до копейки, и телефон для расчёта тоже не нужен. Поэтому город стоит
 * выше доставки, а контакты спрашиваются уже после того, как человек
 * увидел цены. Улицу спросим позже, и только у тех, кто выбрал курьера.
 *
 * Страну проставляем сами: магазин работает по России.
 */
const CityField = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  const [город, setГород] = useState(cart?.shipping_address?.city ?? "")
  const [ошибка, setОшибка] = useState<string | null>(null)
  const прошлый = useRef(cart?.shipping_address?.city ?? "")

  const сохранить = async () => {
    const значение = город.trim()
    if (!значение || значение === прошлый.current) {
      return
    }
    прошлый.current = значение

    try {
      setОшибка(null)
      await updateCheckoutFields({
        адрес: { city: значение, country_code: "ru" },
      })
    } catch (e) {
      setОшибка((e as Error).message)
    }
  }

  return (
    <div className="max-w-sm">
      <Input
        label="Город доставки"
        name="shipping_address.city"
        autoComplete="address-level2"
        value={город}
        onChange={(e) => setГород(e.target.value)}
        onBlur={сохранить}
        required
        data-testid="delivery-city-input"
      />
      {ошибка && (
        <p className="mt-2 text-sm text-red-600">
          Не удалось сохранить: {ошибка}
        </p>
      )}
    </div>
  )
}

export default CityField
