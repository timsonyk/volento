"use client"

import { завершитьОплату } from "@lib/data/oplata"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

/**
 * Ждём, пока банк подтвердит оплату, и превращаем корзину в заказ.
 *
 * Банк обычно отвечает за пару секунд, но может и задержаться. Поэтому
 * спрашиваем несколько раз, а если так и не дождались — честно говорим,
 * что заказ появится сам: банк пришлёт уведомление, и заказ создастся
 * без участия покупателя.
 */
const ПОПЫТОК = 15
const ПАУЗА_МС = 3000

type Состояние = "ждём" | "долго" | "ошибка"

const ВозвратИзБанка = ({ cartId, отказ }: { cartId: string; отказ: boolean }) => {
  const router = useRouter()
  const [состояние, setСостояние] = useState<Состояние>("ждём")

  useEffect(() => {
    if (отказ || !cartId) {
      return
    }

    let остановлено = false

    const спросить = async (попытка: number) => {
      const итог = await завершитьОплату(cartId)

      if (остановлено) {
        return
      }
      if ("заказ" in итог) {
        router.replace(`/${итог.страна}/order/${итог.заказ}/confirmed`)
        return
      }
      if ("ошибка" in итог) {
        setСостояние("ошибка")
        return
      }
      if (попытка + 1 >= ПОПЫТОК) {
        setСостояние("долго")
        return
      }
      setTimeout(() => спросить(попытка + 1), ПАУЗА_МС)
    }

    спросить(0)

    return () => {
      остановлено = true
    }
  }, [cartId, отказ, router])

  if (отказ) {
    return (
      <Сообщение заголовок="Оплата не прошла">
        <p>Деньги не списаны. Можно попробовать ещё раз — корзина сохранилась.</p>
        <LocalizedClientLink href="/checkout" className="mt-6 inline-block underline">
          Вернуться к оформлению
        </LocalizedClientLink>
      </Сообщение>
    )
  }

  if (!cartId || состояние === "ошибка") {
    return (
      <Сообщение заголовок="Не нашли заказ">
        <p>Ссылка неполная. Если деньги списались, заказ придёт на почту.</p>
      </Сообщение>
    )
  }

  if (состояние === "долго") {
    return (
      <Сообщение заголовок="Банк ещё не подтвердил оплату">
        <p>
          Если деньги списались, заказ оформится сам в течение нескольких минут
          — пришлём письмо на почту. Платить второй раз не нужно.
        </p>
        <LocalizedClientLink href="/account/orders" className="mt-6 inline-block underline">
          Мои заказы
        </LocalizedClientLink>
      </Сообщение>
    )
  }

  return (
    <Сообщение заголовок="Проверяем оплату">
      <p>Банк подтверждает платёж, это занимает несколько секунд.</p>
    </Сообщение>
  )
}

const Сообщение = ({
  заголовок,
  children,
}: {
  заголовок: string
  children: React.ReactNode
}) => (
  <div className="mx-auto max-w-md text-center text-ink" data-testid="vozvrat-iz-banka">
    <h1 className="mb-4 text-2xl">{заголовок}</h1>
    <div className="text-sm leading-relaxed text-muted">{children}</div>
  </div>
)

export default ВозвратИзБанка
