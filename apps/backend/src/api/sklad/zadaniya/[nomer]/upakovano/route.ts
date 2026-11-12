import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createOrderShipmentWorkflow } from "@medusajs/medusa/core-flows"

import { УПАКОВАНЫ } from "../../../../../lib/sklad-pakety"
import { собранныеНеУпакованные } from "../../../../../lib/sklad-upakovka"
import { найтиЗаказ } from "../../../../../lib/sklad-zakaz"

/**
 * Склад упаковал, наклеил и отдал посылку на отправку.
 *
 * В Medusa это «отправлено»: заказ уходит из /sklad/k-upakovke. Повтор
 * не ошибка — отвечаем «уже упакован».
 *
 * Заказ из нескольких пакетов можно отмечать по одному: { paket: 2 } —
 * «второй пакет упакован и с наклейкой». Заказ уходит из списка, когда
 * отмечены все. Без paket — упакованы все пакеты разом.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const номер = String((req.params as any).nomer ?? "")

  const заказ = await найтиЗаказ(req, номер)

  if (!заказ) {
    return res.status(404).json({ ошибка: "Заказ не найден" })
  }

  const [отправление] = await собранныеНеУпакованные(req.scope, String(заказ.display_id))

  if (!отправление) {
    return заказ.живыеСборки > 0
      ? res.json({ nomer: номер, sostoyanie: "uzhe_upakovan" })
      : res.status(409).json({ ошибка: "Заказ ещё не собран" })
  }

  if (!отправление.наклейка) {
    return res.status(409).json({
      ошибка: "Наклейки ещё нет — без неё посылку не примут",
    })
  }

  const сырой = (req.body as { paket?: unknown } | undefined)?.paket

  if (сырой !== undefined && сырой !== null) {
    const пакет = отправление.пакеты.find((п) => п.nomer === Number(сырой))

    if (!пакет) {
      return res.status(404).json({
        ошибка: `В этом заказе нет пакета ${String(сырой)} — пакетов ${отправление.пакеты.length}`,
      })
    }

    const остались = отправление.пакеты.filter((п) => !п.upakovan && п.nomer !== пакет.nomer)

    if (остались.length) {
      try {
        const fulfillment = req.scope.resolve(Modules.FULFILLMENT)
        const сборка: any = await fulfillment.retrieveFulfillment(отправление.idСборки)
        await fulfillment.updateFulfillment(отправление.idСборки, {
          metadata: {
            ...(сборка?.metadata ?? {}),
            [УПАКОВАНЫ]: {
              ...((сборка?.metadata ?? {})[УПАКОВАНЫ] ?? {}),
              [String(пакет.nomer)]: new Date().toISOString(),
            },
          },
        } as any)
      } catch (ошибка: any) {
        logger.error(`Склад: пакет ${пакет.nomer} заказа ${номер} не отметился — ${ошибка?.message}`)
        return res
          .status(500)
          .json({ ошибка: "Не удалось отметить", podrobnosti: ошибка?.message })
      }

      logger.info(`Склад упаковал пакет ${пакет.nomer} заказа ${заказ.display_id}`)

      return res.json({
        nomer: номер,
        sostoyanie: "paket_upakovan",
        paket: пакет.nomer,
        ostalos: остались.map((п) => п.nomer),
      })
    }
    // это был последний неотмеченный пакет — заказ упакован целиком
  }

  // Отправляем ровно то, что в этой сборке
  const строки = new Map<string, number>()

  try {
    const { data } = await req.scope
      .resolve(ContainerRegistrationKeys.QUERY)
      .graph({
        entity: "fulfillment",
        fields: ["items.line_item_id", "items.quantity"],
        filters: { id: отправление.idСборки },
      })

    for (const п of (data?.[0]?.items ?? []) as any[]) {
      строки.set(п.line_item_id, (строки.get(п.line_item_id) ?? 0) + Number(п.quantity))
    }

    await createOrderShipmentWorkflow(req.scope).run({
      input: {
        order_id: заказ.id,
        fulfillment_id: отправление.idСборки,
        items: [...строки].map(([id, quantity]) => ({ id, quantity })),
      } as any,
    })

    logger.info(`Склад упаковал заказ ${заказ.display_id}`)

    return res.json({ nomer: номер, sostoyanie: "upakovan" })
  } catch (ошибка: any) {
    logger.error(`Склад: отметка «упаковано» по заказу ${номер} не прошла — ${ошибка?.message}`)
    return res
      .status(500)
      .json({ ошибка: "Не удалось отметить", podrobnosti: ошибка?.message })
  }
}
