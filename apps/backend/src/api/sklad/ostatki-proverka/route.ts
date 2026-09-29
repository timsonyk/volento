import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Посмотреть остатки — для отладки интеграции.
 *
 * GET /sklad/ostatki-proverka — вся таблица (первые 100)
 * GET /sklad/ostatki-proverka?sku=3149-46/170 — один артикул
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const inventory = req.scope.resolve(Modules.INVENTORY)
  const stockLocation = req.scope.resolve(Modules.STOCK_LOCATION)

  const искомыйSku = String(req.query?.sku ?? "").trim()

  try {
    const склады = await stockLocation.listStockLocations({}, { take: 2 })

    if (склады.length !== 1) {
      return res.status(500).json({ ошибка: "Склад не определён" })
    }

    const складИд = склады[0].id

    const фильтр = искомыйSku ? { sku: [искомыйSku] } : {}
    const лимит = искомыйSku ? 1 : 100

    const позиции = await inventory.listInventoryItems(фильтр, {
      select: ["id", "sku"],
      take: лимит,
    })

    if (!позиции.length) {
      return res.json({
        найдено: 0,
        остатки: [],
        ...(искомыйSku ? { sku: искомыйSku, комментарий: "Артикул не найден" } : {}),
      })
    }

    const идыПозиций = позиции.map((п: any) => п.id)

    const уровни = await inventory.listInventoryLevels(
      { inventory_item_id: идыПозиций, location_id: складИд },
      {
        select: ["inventory_item_id", "stocked_quantity", "reserved_quantity"],
        take: идыПозиций.length,
      }
    )

    const уровеньПоПозиции = new Map(
      уровни.map((у: any) => [
        у.inventory_item_id,
        {
          физический: Number(у.stocked_quantity ?? 0),
          резерв: Number(у.reserved_quantity ?? 0),
        },
      ])
    )

    const таблица = позиции.map((п: any) => {
      const у = уровеньПоПозиции.get(п.id) ?? { физический: 0, резерв: 0 }
      return {
        sku: п.sku,
        физический_остаток: у.физический,
        резерв: у.резерв,
        доступно_к_продаже: Math.max(0, у.физический - у.резерв),
      }
    })

    return res.json({
      найдено: таблица.length,
      остатки: таблица,
      ...(искомыйSku ? {} : { показано_первых: лимит }),
    })
  } catch (ошибка: any) {
    logger.error(`Склад: проверка остатков не прошла — ${ошибка?.message}`)
    return res.status(500).json({ ошибка: "Не удалось получить остатки" })
  }
}
