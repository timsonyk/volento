import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createOrderShipmentWorkflow } from "@medusajs/medusa/core-flows"

import { собранныеНеУпакованные } from "../../../../../lib/sklad-upakovka"
import { найтиЗаказ } from "../../../../../lib/sklad-zakaz"

/**
 * Склад упаковал, наклеил и отдал посылку на отправку.
 *
 * В Medusa это «отправлено»: заказ уходит из /sklad/k-upakovke. Повтор
 * не ошибка — отвечаем «уже упакован».
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
