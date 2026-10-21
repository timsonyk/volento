import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { подвестиИтог } from "../../../../../lib/dostavka-itog"
import { строкиСборки, упакованныеНеВыданные } from "../../../../../lib/dostavka-statusy"
import { итогВыдачи } from "../../../../../lib/primerka"
import { найтиЗаказ } from "../../../../../lib/sklad-zakaz"
import { этоТест } from "../../../../../lib/sklad-test-metka"

/**
 * Тестовая выдача в пункте: то, что для настоящих заказов сообщает служба.
 * Только для тестовых заказов, после «упаковано».
 *
 * Тело: { vykupleno: [1, 0] } — сколько штук забрали по каждой строке, в
 * порядке строк заказа. Без тела — забрали всё; [0, 0] — не забрали
 * ничего.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const номер = String((req.params as any).nomer ?? "")
  const заказ = await найтиЗаказ(req, номер)

  if (!заказ) {
    return res.status(404).json({ ошибка: "Заказ не найден" })
  }
  if (!этоТест(заказ)) {
    return res.status(403).json({ ошибка: "Только для тестовых заказов" })
  }

  const [сборка] = (await упакованныеНеВыданные(req.scope)).filter((с: any) => с.order?.id === заказ.id)
  if (!сборка) {
    return res.status(409).json({ ошибка: "Нет упакованной и не выданной посылки — сначала «упаковано»" })
  }

  const строки = строкиСборки(сборка)
  const порядок = заказ.items.map((т) => т.id)
  строки.sort((а, б) => порядок.indexOf(а.id) - порядок.indexOf(б.id))

  const взяли = (req.body as { vykupleno?: unknown })?.vykupleno
  const сколько = строки.map((с, i) =>
    Array.isArray(взяли) ? Math.max(0, Math.min(с.shtuk, Number(взяли[i] ?? 0))) : с.shtuk
  )
  const всего = сколько.reduce((s, n) => s + n, 0)
  const штук = строки.reduce((s, с) => s + с.shtuk, 0)
  const статус = всего === штук ? "delivered" : всего === 0 ? "returned" : "partialReturn"

  // как ответила бы служба: по каждой паре с её кодом
  const товары = строки.flatMap((с, i) =>
    с.kody.map((код, j) => ({ articul: с.artikul, markCode: код, quantity: 1, quantityDelivered: j < сколько[i] ? 1 : 0 }))
  )

  try {
    const итог = await подвестиИтог(req.scope, заказ.id, сборка.id, статус, итогВыдачи(статус, строки, товары)!)
    logger.info(`Тестовая выдача заказа ${заказ.display_id}: ${статус}`)
    return res.json({ nomer: номер, ...итог })
  } catch (ошибка: any) {
    logger.error(`Тестовая выдача заказа ${номер} не прошла — ${ошибка?.message}`)
    return res.status(500).json({ ошибка: "Не удалось выдать", podrobnosti: ошибка?.message })
  }
}
