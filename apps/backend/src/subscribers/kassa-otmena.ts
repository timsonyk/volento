import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { расчётБылЛи, чекВозврата } from "../lib/kassa"
import { позвать } from "../lib/trevoga"

/**
 * Заказ отменили — чек возврата на всё, что предоплачено и не отправлено.
 *
 * Если по заказу уже был полный расчёт (склад собрал, коды в чеке), это
 * уже возврат проданных вещей: такой чек должен вернуть коды в оборот
 * «Честного знака», и делать его вслепую нельзя — зовём человека.
 */
export default async function кассаОтмена({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    const { заказ, был } = await расчётБылЛи(container, data.id)

    if (был) {
      await позвать(container, {
        тема: `Отменён собранный заказ ${заказ.display_id}`,
        текст:
          `По заказу ${заказ.display_id} уже пробит чек полного расчёта с кодами. ` +
          `Чек возврата сам не пробился — напишите мне, пробьём вручную.`,
      })
    }

    await чекВозврата(container, data.id, "otmena")
  } catch (ошибка: any) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(`Заказ ${data.id}: чек возврата не записан — ${ошибка?.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
}
