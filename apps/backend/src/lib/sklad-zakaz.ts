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
  metadata: Record<string, any> | null
  items: { id: string; quantity: number; variant_sku?: string; title?: string }[]
  живыеСборки: number
  /** пункт выдачи, который выбрал покупатель; курьером — null */
  пункт: Record<string, any> | null
  /** тариф службы, который выбрал покупатель */
  тариф: Record<string, any> | null
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
    "metadata",
    "items.id",
    "items.title",
    // Количество живёт в «подробностях» строки, а не в ней самой.
    "items.detail.quantity",
    "items.variant_sku",
    "fulfillments.id",
    "fulfillments.canceled_at",
    "shipping_methods.data",
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

  // Приводим сами: query.graph отдаёт поля как «может быть пусто»,
  // хотя у существующего заказа номер и строки есть всегда.
  return {
    id: String(заказ.id),
    display_id: Number(заказ.display_id),
    status: String(заказ.status),
    metadata: (заказ.metadata as Record<string, any> | null) ?? null,
    items: ((заказ.items ?? []) as any[])
      .filter(Boolean)
      .map((т: any) => ({
        id: String(т.id),
        quantity: Number(т.detail?.quantity ?? 0),
        variant_sku: т.variant_sku ?? undefined,
        title: т.title ?? undefined,
      })),
    живыеСборки: (заказ.fulfillments ?? []).filter((с: any) => !с.canceled_at)
      .length,
    пункт:
      ((заказ as any).shipping_methods ?? [])
        .map((с: any) => с?.data?.apishipData?.point)
        .find(Boolean) ?? null,
    тариф:
      ((заказ as any).shipping_methods ?? [])
        .map((с: any) => с?.data?.apishipData?.tariff)
        .find(Boolean) ?? null,
  }
}
