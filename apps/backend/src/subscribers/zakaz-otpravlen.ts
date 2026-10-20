import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { этоТест } from "../lib/sklad-test-metka"
import {
  названиеСлужбы,
  письмоОтправки,
  ссылкаОтслеживания,
  текстОтправки,
  темаОтправки,
} from "../lib/trek-email"

/**
 * Склад отметил «упаковано» — пишем покупателю номер для отслеживания.
 *
 * Событие приходит на отправку (shipment.created, id — это id сборки).
 * Тестовые заказы склада пропускаем: у них поддельный трек и адрес
 * sklad-test@slytn.ru. Ошибку не пробрасываем — посылка уже уехала,
 * а неотправленное письмо видно в журнале.
 */
export default async function заказОтправлен({
  event: { data },
  container,
}: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  if (data.no_notification) {
    return
  }

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: сборки } = await query.graph({
      entity: "fulfillment",
      filters: { id: data.id },
      fields: [
        "labels.tracking_number",
        "labels.tracking_url",
        "data",
        "order.display_id",
        "order.email",
        "order.metadata",
        "order.shipping_address.first_name",
        "order.shipping_methods.data",
      ],
    })

    const сборка: any = сборки?.[0]
    const заказ = сборка?.order

    if (!заказ?.email || этоТест(заказ)) {
      return
    }

    const метка = (сборка.labels ?? []).find((м: any) => м.tracking_number)
    if (!метка) {
      logger.warn(`Заказ ${заказ.display_id} отправлен без трека — письмо не ушло`)
      return
    }

    const ключСлужбы =
      (заказ.shipping_methods ?? [])[0]?.data?.apishipData?.tariff?.providerKey ?? null

    const данные = {
      номер: `№ ${заказ.display_id}`,
      имя: заказ.shipping_address?.first_name,
      служба: названиеСлужбы(ключСлужбы),
      трек: метка.tracking_number,
      ссылка: ссылкаОтслеживания(ключСлужбы, метка.tracking_number, метка.tracking_url || null),
    }

    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to: заказ.email,
      channel: "email",
      template: "zakaz-otpravlen",
      content: {
        subject: темаОтправки(данные),
        html: письмоОтправки(данные),
        text: текстОтправки(данные),
      },
      data: { replyTo: process.env.EMAIL_REPLY_TO },
    })

    logger.info(`Заказ ${заказ.display_id}: письмо с треком отправлено`)
  } catch (ошибка: any) {
    logger.error(`Письмо с треком по сборке ${data.id} не ушло — ${ошибка?.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "shipment.created",
}
