"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { transferCart } from "@lib/data/customer"

/**
 * Покупатель вошёл, а корзина ещё гостевая — например, вошёл в другой
 * вкладке. Переносим корзину на него и перерисовываем оформление: без
 * этого сервер не даст оплатить (заказ только от вошедшего).
 */
const ПривязкаКорзины = () => {
  const router = useRouter()
  const [сбой, setСбой] = useState(false)

  useEffect(() => {
    transferCart()
      .then(() => router.refresh())
      .catch(() => setСбой(true))
  }, [router])

  return (
    <p className="py-6 text-sm text-muted" data-testid="privyazka-korziny">
      {сбой
        ? "Не получилось перенести корзину в ваш кабинет. Обновите страницу."
        : "Переносим корзину в ваш кабинет…"}
    </p>
  )
}

export default ПривязкаКорзины
