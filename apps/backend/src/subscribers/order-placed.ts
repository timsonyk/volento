import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

import {
  ДанныеПисьма,
  доставкаДляПисьма,
  письмо,
  текстПисьма,
  темаПисьма,
} from "../lib/order-email"
import { отправить } from "../lib/pochta"

/**
 * Письмо покупателю сразу после оформления заказа.
 *
 * Ошибку отправки намеренно не пробрасываем: заказ уже принят и оплачен,
 * и падать из-за недоступной почты нельзя. Неудачу пишем в журнал —
 * по нему видно, что письмо не ушло, и его можно отправить руками.
 */
export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  const notification = container.resolve(Modules.NOTIFICATION)
  const query = container.resolve("query")

  try {
    const { data: заказы } = await query.graph({
      entity: "order",
      filters: { id: data.id },
      // Просим поля целиком, а не по одному: при перечислении по имени
      // часть из них приходила пустой — в письме были «undefined шт.»
      // и нули вместо сумм, хотя в заказе всё посчитано верно.
      // Суммы — поимённо: в «*» вычисляемых итогов нет, в письме были бы
      // нули (так же просит их касса, lib/kassa.ts)
      fields: [
        "*",
        "total",
        "item_total",
        "shipping_total",
        "items.*",
        "items.total",
        "shipping_address.*",
        "shipping_methods.*",
      ],
    })

    const заказ = заказы?.[0]
    if (!заказ?.email) {
      logger.warn(`Заказ ${data.id}: письмо не отправлено, нет адреса почты`)
      return
    }

    const деньги = (сумма?: number | null) =>
      new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: (заказ.currency_code ?? "rub").toUpperCase(),
        maximumFractionDigits: 0,
      }).format(Number(сумма ?? 0))

    const адрес = заказ.shipping_address
    const доставка = доставкаДляПисьма(заказ as any)

    const данные: ДанныеПисьма = {
      номер: `№ ${заказ.display_id}`,
      имя: адрес?.first_name,
      позиции: (заказ.items ?? []).map((п: any) => ({
        название: п.title,
        вариант: п.variant_title,
        количество: п.quantity,
        сумма: деньги(п.total),
      })),
      товары: деньги(заказ.item_total),
      доставка: деньги(заказ.shipping_total),
      итого: деньги(заказ.total),
      способДоставки: доставка.способ,
      адрес: доставка.адрес,
      ссылка: process.env.STOREFRONT_URL
        ? `${process.env.STOREFRONT_URL}/ru/order/${заказ.id}/confirmed`
        : null,
    }

    await отправить(container, {
      to: заказ.email,
      channel: "email",
      template: "order-placed",
      content: {
        subject: темаПисьма(данные),
        html: письмо(данные),
        text: текстПисьма(данные),
      },
      // ответы покупателя должны приходить туда, где их читают
      data: { replyTo: process.env.EMAIL_REPLY_TO },
    })

    logger.info(`Заказ ${заказ.display_id}: письмо отправлено на ${заказ.email}`)
  } catch (e) {
    logger.error(
      `Заказ ${data.id}: письмо не отправлено — ${(e as Error).message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
