import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { этоТест } from "./sklad-test-metka"

/**
 * Собранные, но ещё не упакованные заказы — и наклейки к ним.
 *
 * Наклейку выдаёт служба (Яндекс, СДЭК), и только после того, как
 * отправление у неё создано: заранее её не получить. Плагин ApiShip
 * забирает её сам раз в пять минут; если склад спрашивает раньше —
 * дёргаем ту же синхронизацию сразу, чтобы не ждать.
 */
const { syncApishipShipmentDocumentsWorkflow } = require(
  "@gorgo/medusa-fulfillment-apiship/workflows/sync-apiship-shipment-documents"
)
const { resolveIntegrationOptions } = require("@gorgo/medusa-integration")
const {
  assembleApishipOptions,
  assertApishipToken,
} = require("@gorgo/medusa-fulfillment-apiship/lib/apiship-options")
const { createApishipClient } = require("@gorgo/medusa-fulfillment-apiship/lib/client")
const { fetchShipmentDocuments } = require(
  "@gorgo/medusa-fulfillment-apiship/lib/shipment-documents"
)

export type Отправление = {
  idСборки: string
  idЗаказа: string
  номер: string
  тест: boolean
  служба: string | null
  трек: string | null
  наклейка: string | null
  позиции: { artikul: string | null; nazvanie: string | null; kolichestvo: number }[]
}

const ПОЛЯ = [
  "id",
  "created_at",
  "shipped_at",
  "canceled_at",
  "data",
  "labels.tracking_number",
  "labels.label_url",
  "items.line_item_id",
  "items.quantity",
  "items.sku",
  "items.title",
  "order.id",
  "order.display_id",
  "order.status",
  "order.metadata",
]

const вОтправление = (с: any): Отправление => {
  const ярлык = (с.labels ?? []).find((л: any) => л?.label_url) ?? (с.labels ?? [])[0]

  return {
    idСборки: с.id,
    idЗаказа: с.order?.id,
    номер: String(с.order?.display_id ?? ""),
    тест: этоТест(с.order),
    // Плагин хранит в сборке весь запрос, ушедший в ApiShip
    служба: с.data?.test ? "test" : с.data?.order?.order?.providerKey ?? null,
    трек: ярлык?.tracking_number || null,
    наклейка: ярлык?.label_url || null,
    позиции: (с.items ?? []).map((п: any) => ({
      artikul: п.sku || null,
      nazvanie: п.title || null,
      kolichestvo: Number(п.quantity ?? 0),
    })),
  }
}

async function прочитать(scope: MedusaContainer, номер?: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "fulfillment",
    fields: ПОЛЯ,
    filters: { shipped_at: null, canceled_at: null } as any,
    pagination: { order: { created_at: "ASC" }, take: 200 } as any,
  })

  return (data ?? [])
    .filter((с: any) => с.order && с.order.status !== "canceled")
    .map(вОтправление)
    .filter((о) => !номер || о.номер === номер)
}

/** Собрано, не упаковано. Без наклейки — сначала пробуем её забрать. */
export async function собранныеНеУпакованные(
  scope: MedusaContainer,
  номер?: string
): Promise<Отправление[]> {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)

  const отправления = await прочитать(scope, номер)

  if (!отправления.some((о) => !о.наклейка)) {
    return отправления
  }

  try {
    await syncApishipShipmentDocumentsWorkflow(scope).run({ input: {} })
  } catch (ошибка: any) {
    logger.warn(`Наклейки не подтянулись: ${ошибка?.message}`)
    return отправления
  }

  return прочитать(scope, номер)
}

/**
 * Свежая наклейка вместо устаревшей. Ссылки на печатные формы живут
 * недолго — у СДЭК, по его документации, час, — а мы храним ту, что
 * получили при создании отправления. Не скачалась — спрашиваем ApiShip
 * заново и запоминаем новую.
 */
export async function обновитьНаклейку(
  scope: MedusaContainer,
  idСборки: string
): Promise<string | null> {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
  const fulfillmentModule = scope.resolve(Modules.FULFILLMENT)

  const сборка: any = await fulfillmentModule.retrieveFulfillment(idСборки)
  const orderId = сборка?.data?.orderId

  if (!orderId) {
    return null
  }

  const options = assembleApishipOptions(
    await resolveIntegrationOptions({
      identifier: "apiship",
      instance_id: сборка.data.instanceId ?? null,
    })
  )
  assertApishipToken(options)

  const ярлыки = await fetchShipmentDocuments({
    apishipClient: createApishipClient({ token: options.token, isTest: options.is_test }),
    orderId,
    logger,
    maxAttempts: 3,
  })

  const ссылка = ярлыки?.[0]?.label_url || null

  if (ссылка) {
    await fulfillmentModule.updateFulfillment(idСборки, { labels: ярлыки })
  }

  return ссылка
}
