import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { ВЗЯТ } from "../../../../../lib/sklad-sborka"
import { найтиЗаказ } from "../../../../../lib/sklad-zakaz"

/**
 * Склад увидел заказ и взялся собирать — «готов, собираю».
 *
 * Сборка занимает время, а коды «Честного знака» появляются только в
 * конце, когда брюки пакуют. Эта отметка говорит сторожу
 * (jobs/sklad-molchit), что склад заказ получил, — иначе через три
 * минуты он поднял бы тревогу, хотя всё идёт своим ходом. Остаток эта
 * отметка не трогает, его спишет сборка.
 *
 * Повтор не ошибка: отвечаем тем же.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const orderModule = req.scope.resolve(Modules.ORDER)
  const номер = String((req.params as any).nomer ?? "")

  const заказ = await найтиЗаказ(req, номер)

  if (!заказ) {
    return res.status(404).json({ ошибка: "Заказ не найден" })
  }

  if (заказ.status === "canceled") {
    return res.status(409).json({ ошибка: "Заказ отменён" })
  }

  if (заказ.живыеСборки > 0) {
    return res.json({ nomer: номер, sostoyanie: "uzhe_v_sborke" })
  }

  if ((заказ.metadata ?? {})[ВЗЯТ]) {
    return res.json({ nomer: номер, sostoyanie: "vzyat" })
  }

  await orderModule.updateOrders([
    {
      id: заказ.id,
      metadata: { ...(заказ.metadata ?? {}), [ВЗЯТ]: new Date().toISOString() },
    },
  ])

  logger.info(`Склад взялся за заказ ${заказ.display_id}`)

  return res.json({ nomer: номер, sostoyanie: "vzyat" })
}
