import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { ВЗЯТ, НЕХВАТКА } from "../lib/sklad-sborka"
import { этоТест } from "../lib/sklad-test-metka"
import { пробный } from "../lib/zamok-zakazov"

/**
 * Сторож: заказ оплачен, а склад за него не взялся.
 *
 * Пока склад молчит, покупатель видит «обрабатывается» и ждёт. Сам
 * заказ мы не трогаем — ни отменять, ни обещать сборку за склад нельзя:
 * в первом случае отменим то, что лежит на полке, во втором пообещаем
 * то, чего нет. Поэтому просто зовём человека.
 *
 * Письмо на каждый заказ шлём один раз: отметку ставим в сам заказ,
 * чтобы она пережила перезапуск.
 */
const МОЛЧИТ_МИНУТ = Number(process.env.SKLAD_TREVOGA_MINUT || 3)
const ОТМЕТКА = "sklad_trevoga_otpravlena"

export default async function складМолчит(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const notification = container.resolve(Modules.NOTIFICATION)
  const orderModule = container.resolve(Modules.ORDER)

  const кому = process.env.EMAIL_TREVOGA

  if (!кому) {
    return
  }

  const порог = new Date(Date.now() - МОЛЧИТ_МИНУТ * 60_000)

  try {
    const { data: заказы } = await query.graph({
      entity: "order",
      filters: { status: "pending" } as any,
      fields: [
        "id",
        "display_id",
        "created_at",
        "metadata",
        "items.variant_sku",
        "items.quantity",
        "fulfillments.id",
        "fulfillments.canceled_at",
      ],
      pagination: { order: { created_at: "ASC" }, take: 200 },
    })

    const брошенные = (заказы ?? []).filter((з: any) => {
      if (new Date(з.created_at) > порог) {
        return false
      }
      if ((з.metadata ?? {})[ОТМЕТКА]) {
        return false
      }
      // Склад ответил «собираю» или собрал не всё и ждёт нашего звонка
      // покупателю — он не молчит.
      if ((з.metadata ?? {})[ВЗЯТ] || (з.metadata ?? {})[НЕХВАТКА]) {
        return false
      }
      // пробные заказы складу не отдаются — и молчит он о них законно;
      // тестовые склад гоняет сам, когда хочет
      if (пробный(з) || этоТест(з)) {
        return false
      }
      return (з.fulfillments ?? []).filter((с: any) => !с.canceled_at).length === 0
    })

    for (const заказ of брошенные) {
      const позиции = (заказ.items ?? [])
        .map((т: any) => `${т.variant_sku} — ${т.quantity} шт.`)
        .join("\n")

      const минут = Math.round(
        (Date.now() - new Date(заказ.created_at).getTime()) / 60_000
      )

      await notification.createNotifications({
        to: кому,
        channel: "email",
        template: "sklad-molchit",
        content: {
          subject: `Заказ ${заказ.display_id}: склад не отвечает ${минут} мин.`,
          text:
            `Заказ ${заказ.display_id} оплачен ${минут} минут назад, ` +
            `склад его не забрал.\n\n${позиции}\n\n` +
            `Покупатель видит «обрабатывается». Проверьте, идёт ли обмен.`,
        },
        data: {
          zakaz: заказ.display_id,
          minut: минут,
        },
      } as any)

      // Отметку ставим после отправки: если письмо не ушло, сторож
      // попробует ещё раз на следующем круге.
      await orderModule.updateOrders([
        {
          id: заказ.id,
          metadata: { ...(заказ.metadata ?? {}), [ОТМЕТКА]: new Date().toISOString() },
        },
      ])

      logger.warn(`Склад молчит по заказу ${заказ.display_id} уже ${минут} мин.`)
    }
  } catch (ошибка: any) {
    logger.error(`Сторож склада не отработал: ${ошибка?.message}`)
  }
}

export const config = {
  name: "sklad-molchit",
  // Раз в минуту: порог всё равно считаем по времени заказа, так что
  // письмо придёт близко к трём минутам, а не когда попало.
  schedule: "* * * * *",
}
