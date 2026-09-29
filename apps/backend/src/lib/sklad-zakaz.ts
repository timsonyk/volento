import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaRequest } from "@medusajs/framework/http"

/**
 * Заказ по номеру, который видит склад.
 *
 * Склад знает заказ по короткому номеру из письма покупателю
 * (display_id), а не по нашему внутреннему. Ищем по обоим: если склад
 * однажды пришлёт внутренний, тоже поймём.
 */
export type ЗаказДляСклада = {
  id: string
  display_id: number
  status: string
  items: { id: string; quantity: number; variant_sku?: string }[]
  живыеСборки: number
}

export async function найтиЗаказ(
  req: MedusaRequest,
  номер: string
): Promise<ЗаказДляСклада | null> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const чистый = String(номер ?? "").trim()

  if (!чистый) {
    return null
  }

  const поля = [
    "id",
    "display_id",
    "status",
    "items.id",
    "items.quantity",
    "items.variant_sku",
    "fulfillments.id",
    "fulfillments.canceled_at",
  ]

  const числом = Number(чистый)
  const фильтр = Number.isInteger(числом)
    ? { display_id: числом }
    : { id: чистый }

  const { data: заказы } = await query.graph({
    entity: "order",
    filters: фильтр as any,
    fields: поля,
  })

  const заказ = (заказы ?? [])[0]

  if (!заказ) {
    return null
  }

  return {
    id: заказ.id,
    display_id: заказ.display_id,
    status: заказ.status,
    items: заказ.items ?? [],
    живыеСборки: (заказ.fulfillments ?? []).filter((с: any) => !с.canceled_at)
      .length,
  }
}
