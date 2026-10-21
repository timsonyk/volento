import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ожидаемыеВозвраты } from "../../../lib/sklad-vozvraty"

/**
 * Что едет обратно на склад: пары, которые покупатель не забрал в пункте
 * выдачи. По каждой — артикул и код «Честного знака», чтобы сверить
 * посылку при приёме. Принял — POST /sklad/zadaniya/:nomer/vozvrat.
 *
 * ?test=1 — только тестовые заказы, без него — только настоящие.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    return res.json({ vozvraty: await ожидаемыеВозвраты(req.scope, req.query.test === "1") })
  } catch (ошибка: any) {
    logger.error(`Склад: не отдали возвраты — ${ошибка?.message}`)
    return res.status(500).json({ ошибка: "Не удалось получить возвраты" })
  }
}
