import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Проверка ключа склада на всех эндпойнтах /sklad/*.
 *
 * Ключ передаётся в заголовке X-Sklad-Key. Сам ключ хранится в переменной
 * окружения SKLAD_API_KEY — так его можно поменять без пересборки.
 */
const КЛЮЧ = process.env.SKLAD_API_KEY

export async function authenticate(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  if (!КЛЮЧ) {
    logger.error("SKLAD_API_KEY не задан — API склада недоступно")
    return res.status(500).json({ ошибка: "API недоступно" })
  }

  const присланный = req.headers["x-sklad-key"]

  if (присланный !== КЛЮЧ) {
    logger.warn(`Склад: неверный ключ с ${req.ip}`)
    return res.status(401).json({ ошибка: "Неверный ключ" })
  }

  next()
}
