import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"

import { найтиЗаказ } from "../../../../../lib/sklad-zakaz"

/**
 * Склад берёт заказ в сборку — то же, что «подтвердить сборочное
 * задание» у Вайлдберриза.
 *
 * Повторный вызов не ошибка: склад мог не получить наш ответ и позвонить
 * ещё раз. Отвечаем тем же «уже в сборке», а второй сборки не заводим —
 * иначе остаток списался бы дважды.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const stockLocation = req.scope.resolve(Modules.STOCK_LOCATION)
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

  const склады = await stockLocation.listStockLocations({}, { take: 2 })

  if (склады.length !== 1) {
    logger.error(`Складов ${склады.length}, ожидался один`)
    return res.status(500).json({ ошибка: "Склад не определён" })
  }

  // Можно прислать список позиций — тогда соберём только их, как при
  // частичной отгрузке. Не прислали — собираем заказ целиком.
  const тело = req.body as { pozicii?: { id_stroki: string; kolichestvo: number }[] }
  const строки = Array.isArray(тело?.pozicii) && тело!.pozicii!.length
    ? тело!.pozicii!.map((п) => ({
        id: String(п.id_stroki),
        quantity: Number(п.kolichestvo),
      }))
    : заказ.items.map((т) => ({ id: т.id, quantity: т.quantity }))

  const чужие = строки.filter(
    (с) => !заказ.items.some((т) => т.id === с.id)
  )

  if (чужие.length) {
    return res
      .status(400)
      .json({ ошибка: "Эти строки не из этого заказа", stroki: чужие })
  }

  try {
    const { result } = await createOrderFulfillmentWorkflow(req.scope).run({
      input: {
        order_id: заказ.id,
        location_id: склады[0].id,
        items: строки,
      } as any,
    })

    logger.info(`Склад взял заказ ${заказ.display_id} в сборку`)

    return res.json({
      nomer: номер,
      sostoyanie: "v_sborke",
      id_sborki: (result as any)?.id,
    })
  } catch (ошибка: any) {
    logger.error(`Склад: сборка заказа ${номер} не завелась — ${ошибка?.message}`)
    return res
      .status(500)
      .json({ ошибка: "Не удалось взять в сборку", podrobnosti: ошибка?.message })
  }
}
