import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { чекПредоплаты } from "../lib/kassa"

/**
 * Чек «Предоплата 100 %», как только заказ оплачен.
 *
 * Сейчас оплата одностадийная: к оформлению заказа деньги уже списаны.
 * Если включат двухстадийную (TOCHKA_PREAUTH), деньги спишутся позже —
 * тогда сюда надо добавить событие списания платежа «payment.captured».
 */
export default async function кассаПредоплата({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    await чекПредоплаты(container, data.id)
  } catch (ошибка: any) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(`Заказ ${data.id}: чек предоплаты не записан — ${ошибка?.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
