import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { доставкаДляПисьма } from "../lib/order-email"
import { этоТест } from "../lib/sklad-test-metka"
import { сводкаВладельцу } from "../lib/zakaz-vladelcu"

/**
 * Новый заказ — сказать владельцу.
 *
 * В колокольчик админки всегда; письмом — если задан EMAIL_ZAKAZY (на
 * EMAIL_TREVOGA не шлём: там тревоги, и обычный заказ среди них
 * потеряется или, наоборот, приучит не читать тревоги).
 *
 * Тестовые заказы склада пропускаем.
 */
export default async function заказВладельцу({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const notification = container.resolve(Modules.NOTIFICATION)

  try {
    const { data: заказы } = await query.graph({
      entity: "order",
      filters: { id: data.id },
      fields: [
        "*",
        "total",
        "items.*",
        "shipping_address.*",
        "shipping_methods.*",
      ],
    })
    const заказ: any = заказы?.[0]
    if (!заказ || этоТест(заказ)) {
      return
    }

    const { тема, текст } = сводкаВладельцу(заказ, доставкаДляПисьма(заказ))

    const уведомления: any[] = [
      {
        to: "",
        channel: "feed",
        template: "admin-ui",
        data: { title: тема, description: текст },
      },
    ]
    if (process.env.EMAIL_ZAKAZY) {
      уведомления.push({
        to: process.env.EMAIL_ZAKAZY,
        channel: "email",
        template: "trevoga",
        content: { subject: тема, text: текст },
      })
    }

    await notification.createNotifications(уведомления)
  } catch (ошибка: any) {
    logger.error(`Заказ ${data.id}: владельцу не сообщили — ${ошибка?.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
