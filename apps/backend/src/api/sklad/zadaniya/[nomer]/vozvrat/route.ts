import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { принятьВозврат } from "../../../../../lib/sklad-vozvraty"
import { найтиЗаказ } from "../../../../../lib/sklad-zakaz"

/**
 * Склад принял возврат невыкупленного: { kody: [...] } — коды пар,
 * которые пришли, как отдаёт сканер.
 *
 * Совпали с ожидаемыми — всё, пары можно продавать снова (остаток склад
 * пришлёт обычной заливкой). Не совпали — отвечаем, какие не ждали и
 * какие не пришли, и зовём человека. Повтор не ошибка: uzhe_prinyat.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const номер = String((req.params as any).nomer ?? "")
  const kody = (req.body as { kody?: unknown })?.kody

  if (!Array.isArray(kody)) {
    return res.status(400).json({ ошибка: "Пришлите kody — коды пар, которые вернулись" })
  }

  const заказ = await найтиЗаказ(req, номер)
  if (!заказ) {
    return res.status(404).json({ ошибка: "Заказ не найден" })
  }

  try {
    const итог = await принятьВозврат(req.scope, заказ, kody.map(String))
    if (!итог) {
      return res.status(409).json({ ошибка: "По этому заказу возврата не ждём" })
    }
    logger.info(`Склад принял возврат по заказу ${заказ.display_id}${итог.sovpalo ? "" : " — коды не совпали"}`)
    return res.json({ nomer: номер, ...итог })
  } catch (ошибка: any) {
    logger.error(`Склад: возврат по заказу ${номер} не принят — ${ошибка?.message}`)
    return res.status(500).json({ ошибка: "Не удалось принять возврат", podrobnosti: ошибка?.message })
  }
}
