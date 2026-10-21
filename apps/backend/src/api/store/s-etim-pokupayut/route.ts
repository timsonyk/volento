import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { посчитатьПары, сЭтимПокупают } from "../../../lib/s-etim-pokupayut"

/**
 * GET /store/s-etim-pokupayut?id=prod_… — id товаров, которые покупали
 * вместе с этим. Как считаем — lib/s-etim-pokupayut.ts.
 *
 * Пересчитываем раз в час: заказы в одну корзину приходят не каждую
 * минуту, а пересчёт проходит по всем заказам.
 */
const ДЕРЖИМ_МС = 3600_000

let запомнили: { когда: number; пары: ReturnType<typeof посчитатьПары> } | null = null

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const id = String((req.query as Record<string, unknown>).id ?? "")

  if (!id) {
    return res.status(400).json({ message: "Нужен id товара" })
  }

  if (!запомнили || Date.now() - запомнили.когда > ДЕРЖИМ_МС) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

    try {
      const { data } = await query.graph({
        entity: "order",
        fields: ["id", "status", "metadata", "items.product_id"],
        pagination: { take: 10_000, order: { created_at: "DESC" } },
      })
      запомнили = { когда: Date.now(), пары: посчитатьПары(data as any[]) }
    } catch (ошибка: any) {
      // без подсказки витрина просто не покажет блок
      logger.warn(`«С этим покупают» не посчитали: ${ошибка?.message}`)
      return res.json({ ids: [] })
    }
  }

  return res.json({ ids: сЭтимПокупают(запомнили.пары, id) })
}
