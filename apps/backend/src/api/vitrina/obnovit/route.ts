import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { забытьВсё, ключОбновления } from "../../../lib/pamyat-vitriny"

/**
 * Сбросить память бэкенда и витрины — см. lib/pamyat-vitriny.ts.
 * Только со своим ключом: снаружи сюда ходить незачем.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const ключ = ключОбновления()

  if (!ключ || req.headers["x-klyuch"] !== ключ) {
    return res.status(403).json({ ошибка: "Нет доступа" })
  }

  забытьВсё()

  const витрина = process.env.STOREFRONT_INTERNAL_URL || "http://127.0.0.1:8000"

  try {
    const ответ = await fetch(`${витрина}/api/obnovit`, {
      method: "POST",
      headers: { "x-klyuch": ключ },
    })
    if (!ответ.ok) {
      throw new Error(`витрина ответила ${ответ.status}`)
    }
  } catch (ошибка: any) {
    logger.warn(`Витрина не сбросила память: ${ошибка?.message}`)
    return res.status(502).json({ ошибка: "Витрина не ответила" })
  }

  logger.info("Витрина обновлена после правки в админке")
  return res.json({ ok: true })
}
