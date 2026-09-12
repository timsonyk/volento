"use client"

import { useEffect, useRef, useState } from "react"

import { updateCheckoutFields } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { Heading } from "@modules/common/components/ui"
import Input from "@modules/common/components/input"

/**
 * Данные получателя: с кем связаться по заказу.
 *
 * Отдельный блок от адреса, но пишет в тот же заказ, поэтому сохраняем
 * через дозапись — иначе блоки затирали бы поля друг друга.
 *
 * Сохраняем при уходе из поля и только если что-то изменилось: кнопки
 * «сохранить» на одностраничном оформлении нет.
 */
const Recipient = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  const адрес = cart?.shipping_address
  const заметки = (cart?.metadata ?? {}) as Record<string, string>

  const [поля, setПоля] = useState({
    фамилия: адрес?.last_name ?? "",
    имя: адрес?.first_name ?? "",
    почта: cart?.email ?? "",
    телефон: адрес?.phone ?? "",
    рождение: заметки["дата_рождения"] ?? "",
    комментарий: заметки["комментарий"] ?? "",
  })

  const [ошибка, setОшибка] = useState<string | null>(null)
  const прошлое = useRef(JSON.stringify(поля))

  useEffect(() => {
    прошлое.current = JSON.stringify(поля)
    // сравниваем только при первой отрисовке: дальше следим сами
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const менять =
    (ключ: keyof typeof поля) => (e: { target: { value: string } }) =>
      setПоля((п) => ({ ...п, [ключ]: e.target.value }))

  const сохранить = async () => {
    const слепок = JSON.stringify(поля)
    if (слепок === прошлое.current) {
      return
    }
    прошлое.current = слепок

    try {
      setОшибка(null)
      await updateCheckoutFields({
        email: поля.почта || undefined,
        адрес: {
          first_name: поля.имя,
          last_name: поля.фамилия,
          phone: поля.телефон,
        },
        заметки: {
          дата_рождения: поля.рождение,
          комментарий: поля.комментарий,
        },
      })
    } catch (e) {
      setОшибка((e as Error).message)
    }
  }

  return (
    <div>
      <Heading level="h2" className="mb-6 text-3xl-regular">
        Данные получателя
      </Heading>

      <div
        className="grid grid-cols-1 gap-4 small:grid-cols-2"
        onBlur={сохранить}
      >
        <Input
          label="Фамилия"
          name="recipient.last_name"
          autoComplete="family-name"
          value={поля.фамилия}
          onChange={менять("фамилия")}
          required
          data-testid="recipient-last-name-input"
        />
        <Input
          label="Имя"
          name="recipient.first_name"
          autoComplete="given-name"
          value={поля.имя}
          onChange={менять("имя")}
          required
          data-testid="recipient-first-name-input"
        />
        <Input
          label="Почта"
          name="recipient.email"
          type="email"
          autoComplete="email"
          title="Введите корректный адрес почты."
          value={поля.почта}
          onChange={менять("почта")}
          required
          data-testid="recipient-email-input"
        />
        {/* Телефон обязателен: без него служба доставки не считает
            стоимость и не создаёт отправление, да и курьер звонит. */}
        <Input
          label="Телефон"
          name="recipient.phone"
          autoComplete="tel"
          value={поля.телефон}
          onChange={менять("телефон")}
          required
          data-testid="recipient-phone-input"
        />
        <Input
          label="Дата рождения"
          name="recipient.birthday"
          value={поля.рождение}
          onChange={менять("рождение")}
          data-testid="recipient-birthday-input"
        />
        <Input
          label="Комментарий к заказу"
          name="recipient.comment"
          value={поля.комментарий}
          onChange={менять("комментарий")}
          data-testid="recipient-comment-input"
        />
      </div>

      {ошибка && (
        <p className="mt-3 text-sm text-red-600" data-testid="recipient-error">
          Не удалось сохранить: {ошибка}
        </p>
      )}
    </div>
  )
}

export default Recipient
