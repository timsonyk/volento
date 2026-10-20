"use client"

import { useEffect, useRef, useState } from "react"

import { updateCheckoutFields } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import Input from "@modules/common/components/input"

import { useОтметка } from "../steps/context"

/**
 * Данные получателя: с кем связаться по заказу.
 *
 * Отдельный блок от адреса, но пишет в тот же заказ, поэтому сохраняем
 * через дозапись — иначе блоки затирали бы поля друг друга.
 *
 * Сохраняем при уходе из поля и только если что-то изменилось: кнопки
 * «сохранить» на одностраничном оформлении нет.
 *
 * Проверяем поля сами, а не браузером. У браузера свои всплывашки —
 * серые, на языке системы, с текстом вроде «Введите адрес электронной
 * почты», и выглядят они чужеродно. Наши ошибки появляются прямо под
 * полем и написаны по-человечески: что не так и как надо.
 *
 * Ошибку показываем только после того, как из поля ушли: подсвечивать
 * пустое поле, пока человек до него ещё не добрался, — невежливо.
 */
type Поля = {
  фамилия: string
  имя: string
  почта: string
  телефон: string
  комментарий: string
}

type Ключ = keyof Поля

// Намеренно нестрогая: задача — поймать опечатку вроде «anna@mail» или
// пробела в адресе, а не пересказать почтовый стандарт.
const ПОХОЖЕ_НА_ПОЧТУ = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const проверить = (поля: Поля): Partial<Record<Ключ, string>> => {
  const о: Partial<Record<Ключ, string>> = {}

  if (!поля.фамилия.trim()) {
    о.фамилия = "Укажите фамилию — её печатают на посылке"
  }
  if (!поля.имя.trim()) {
    о.имя = "Укажите имя"
  }

  const почта = поля.почта.trim()
  if (!почта) {
    о.почта = "Укажите почту — на неё придёт подтверждение заказа"
  } else if (!ПОХОЖЕ_НА_ПОЧТУ.test(почта)) {
    о.почта = "Кажется, в адресе опечатка. Пример: anna@mail.ru"
  }

  const цифры = поля.телефон.replace(/\D/g, "")
  if (!цифры) {
    о.телефон = "Укажите телефон — по нему позвонит курьер"
  } else if (цифры.length !== 11) {
    о.телефон = "В номере должно быть 11 цифр. Пример: +7 900 123-45-67"
  }

  return о
}

const Recipient = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  const адрес = cart?.shipping_address
  const заметки = (cart?.metadata ?? {}) as Record<string, string>

  const [поля, setПоля] = useState<Поля>({
    фамилия: адрес?.last_name ?? "",
    имя: адрес?.first_name ?? "",
    почта: cart?.email ?? "",
    телефон: адрес?.phone ?? "",
    комментарий: заметки["комментарий"] ?? "",
  })

  const [ушли, setУшли] = useState<Partial<Record<Ключ, boolean>>>({})
  const [сбой, setСбой] = useState<string | null>(null)
  const прошлое = useRef(JSON.stringify(поля))
  const отметить = useОтметка()

  const ошибки = проверить(поля)
  const всёЗаполнено = Object.keys(ошибки).length === 0

  useEffect(() => {
    прошлое.current = JSON.stringify(поля)
    // сравниваем только при первой отрисовке: дальше следим сами
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Следующий пункт открывается, как только поля заполнены верно, —
  // не дожидаясь, пока сервер подтвердит запись.
  useEffect(() => {
    отметить("получатель", всёЗаполнено && !сбой)
  }, [всёЗаполнено, сбой, отметить])

  const менять = (ключ: Ключ) => (e: { target: { value: string } }) =>
    setПоля((п) => ({ ...п, [ключ]: e.target.value }))

  const сохранить = async () => {
    const слепок = JSON.stringify(поля)
    if (слепок === прошлое.current) {
      return
    }
    прошлое.current = слепок

    try {
      setСбой(null)
      await updateCheckoutFields({
        email: поля.почта.trim() || undefined,
        адрес: {
          first_name: поля.имя.trim(),
          last_name: поля.фамилия.trim(),
          phone: поля.телефон.trim(),
        },
        заметки: {
          комментарий: поля.комментарий,
        },
      })
    } catch (e) {
      прошлое.current = ""
      setСбой((e as Error).message)
    }
  }

  // Уход из поля делает две вещи: помечает поле как пройденное, чтобы
  // можно было показать ошибку, и сохраняет блок целиком.
  const ушёлИз = (ключ: Ключ) => () => {
    setУшли((б) => (б[ключ] ? б : { ...б, [ключ]: true }))
    сохранить()
  }

  const виднаОшибка = (ключ: Ключ) => (ушли[ключ] ? ошибки[ключ] : null)

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 small:grid-cols-2">
        <Input
          label="Фамилия"
          name="recipient.last_name"
          autoComplete="family-name"
          value={поля.фамилия}
          onChange={менять("фамилия")}
          onBlur={ушёлИз("фамилия")}
          обязательно
          ошибка={виднаОшибка("фамилия")}
          data-testid="recipient-last-name-input"
        />
        <Input
          label="Имя"
          name="recipient.first_name"
          autoComplete="given-name"
          value={поля.имя}
          onChange={менять("имя")}
          onBlur={ушёлИз("имя")}
          обязательно
          ошибка={виднаОшибка("имя")}
          data-testid="recipient-first-name-input"
        />
        {/* type="text", а не "email": иначе браузер поверх нашей ошибки
            показал бы ещё и свою всплывашку. Проверяем сами. */}
        <Input
          label="Почта"
          name="recipient.email"
          type="text"
          inputMode="email"
          autoComplete="email"
          value={поля.почта}
          onChange={менять("почта")}
          onBlur={ушёлИз("почта")}
          обязательно
          ошибка={виднаОшибка("почта")}
          data-testid="recipient-email-input"
        />
        {/* Телефон обязателен: без него служба доставки не считает
            стоимость и не создаёт отправление, да и курьер звонит. */}
        <Input
          label="Телефон"
          name="recipient.phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={поля.телефон}
          onChange={менять("телефон")}
          onBlur={ушёлИз("телефон")}
          обязательно
          ошибка={виднаОшибка("телефон")}
          data-testid="recipient-phone-input"
        />
        <Input
          label="Комментарий к заказу"
          name="recipient.comment"
          value={поля.комментарий}
          onChange={менять("комментарий")}
          onBlur={ушёлИз("комментарий")}
          data-testid="recipient-comment-input"
        />
      </div>

      {сбой && (
        <p className="mt-3 text-sm text-red-600" data-testid="recipient-error">
          Не удалось сохранить: {сбой}
        </p>
      )}
    </div>
  )
}

export default Recipient
