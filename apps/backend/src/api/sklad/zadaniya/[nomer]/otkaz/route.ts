import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"

import { найтиЗаказ } from "../../../../../lib/sklad-zakaz"

/**
 * Склад отказывается от заказа — то же, что отказ по сборочному
 * заданию у Вайлдберриза. Бывает, когда последнюю пару купили сразу в
 * двух местах: договорились, что выигрывает тот, кто успел первым, а
 * второму отказ.
 *
 * Отмена в Medusa снимает резерв и возвращает деньги сама — отдельно
 * ничего делать не нужно. Письмо покупателю пишем мы.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const номер = String((req.params as any).nomer ?? "")

  const заказ = await найтиЗаказ(req, номер)

  if (!заказ) {
    return res.status(404).json({ ошибка: "Заказ не найден" })
  }

  if (заказ.status === "canceled") {
    // Повтор — не ошибка: склад мог не получить наш ответ.
    return res.json({ nomer: номер, sostoyanie: "uzhe_otmenen" })
  }

  if (заказ.живыеСборки > 0) {
    return res.status(409).json({
      ошибка: "Заказ уже в сборке, отказаться нельзя",
      podskazka: "После «собрано» отказ невозможен — напишите нам",
    })
  }

  const причина = String((req.body as any)?.prichina ?? "net_na_sklade")

  try {
    await cancelOrderWorkflow(req.scope).run({
      input: { order_id: заказ.id } as any,
    })

    logger.warn(
      `Склад отказался от заказа ${заказ.display_id}, причина: ${причина}`
    )

    return res.json({ nomer: номер, sostoyanie: "otmenen", prichina: причина })
  } catch (ошибка: any) {
    logger.error(`Склад: отказ по заказу ${номер} не прошёл — ${ошибка?.message}`)
    return res
      .status(500)
      .json({ ошибка: "Не удалось отменить", podrobnosti: ошибка?.message })
  }
}
