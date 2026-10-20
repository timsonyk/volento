"use client"

import { useEffect, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Уведомление об использовании файлов cookie.
 *
 * Прямого требования показывать баннер в 152-ФЗ нет, но Роскомнадзор
 * считает cookie с идентификаторами персональными данными, а штрафы за
 * обработку без согласия с 2025 года доходят до сотен тысяч. Поэтому
 * согласие спрашиваем явно.
 *
 * Выбор храним в localStorage, а не в cookie: это настройка одного
 * браузера, на сервер её передавать незачем. Вместе с выбором пишем
 * дату и версию текста — если текст изменится, спросим заново.
 */

const КЛЮЧ = "volento_cookie_consent"

/** Версия уведомления. Поднять при изменении состава cookie или текста. */
const ВЕРСИЯ = 2

type Выбор = {
  версия: number
  решение: "принято" | "только необходимые"
  когда: string
}

const прочитать = (): Выбор | null => {
  try {
    const сырое = window.localStorage.getItem(КЛЮЧ)
    if (!сырое) {
      return null
    }
    const выбор = JSON.parse(сырое) as Выбор
    return выбор?.версия === ВЕРСИЯ ? выбор : null
  } catch {
    // приватный режим, запрет на хранилище, битое значение — молча
    // считаем, что выбора не было: баннер покажется ещё раз
    return null
  }
}

const записать = (решение: Выбор["решение"]) => {
  try {
    const выбор: Выбор = {
      версия: ВЕРСИЯ,
      решение,
      когда: new Date().toISOString(),
    }
    window.localStorage.setItem(КЛЮЧ, JSON.stringify(выбор))
  } catch {
    // не смогли сохранить — не беда, баннер просто появится снова
  }
}

const CookieNotice = () => {
  // Пока не смонтировались, не рисуем ничего: иначе баннер мигнёт
  // у тех, кто уже согласился, — разметка с сервера про выбор не знает.
  const [показывать, setПоказывать] = useState(false)

  useEffect(() => {
    if (!прочитать()) {
      setПоказывать(true)
    }
  }, [])

  if (!показывать) {
    return null
  }

  const решить = (решение: Выбор["решение"]) => {
    записать(решение)
    setПоказывать(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Использование файлов cookie"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-paper px-4 py-5 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] small:px-[50px]"
      data-testid="cookie-notice"
    >
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 small:flex-row small:items-center small:justify-between">
        <p className="max-w-[62ch] text-sm leading-relaxed text-ink">
          Мы используем файлы cookie, чтобы работали корзина и вход, и чтобы
          понимать, как пользуются сайтом. Нажимая «Принять», вы соглашаетесь
          на все cookie; «Только необходимые» — только на те, без которых
          не работают корзина и вход. Подробнее — в{" "}
          <LocalizedClientLink href="/politika" className="underline">
            политике конфиденциальности
          </LocalizedClientLink>
          .
        </p>

        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => решить("только необходимые")}
            className="border border-rule px-5 py-2.5 text-sm text-ink transition-colors hover:bg-mist"
            data-testid="cookie-necessary"
          >
            Только необходимые
          </button>
          <button
            type="button"
            onClick={() => решить("принято")}
            className="bg-ink px-5 py-2.5 text-sm text-paper transition-opacity hover:opacity-85"
            data-testid="cookie-accept"
          >
            Принять
          </button>
        </div>
      </div>
    </div>
  )
}

export default CookieNotice
