import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { создатьТестовыйЗаказ } from "../../../../lib/sklad-test"

/**
 * Создать тестовый заказ — чтобы склад проверил свой обмен, ничего не
 * отправляя на самом деле. Что в нём ненастоящее — lib/sklad-test.ts.
 *
 * Тело: { kolichestva: [3] } — одна строка, 3 шт.; [2, 1] — две строки.
 * Без тела — одна строка, 1 шт.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const пришло = (req.body as { kolichestva?: unknown })?.kolichestva

  const количества = Array.isArray(пришло) && пришло.length ? пришло.map(Number) : [1]

  if (
    количества.length > 3 ||
    количества.some((ч) => !Number.isInteger(ч) || ч < 1 || ч > 10)
  ) {
    return res.status(400).json({
      ошибка: "kolichestva — до трёх строк, в каждой от 1 до 10 шт.",
    })
  }

  try {
    const заказ = await создатьТестовыйЗаказ(req.scope, количества)
    logger.info(`Склад создал тестовый заказ ${заказ.nomer}`)
    return res.json(заказ)
  } catch (ошибка: any) {
    logger.error(`Тестовый заказ не создался: ${ошибка?.message}`)
    return res.status(500).json({ ошибка: "Не удалось создать тестовый заказ", podrobnosti: ошибка?.message })
  }
}
