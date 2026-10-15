import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { привязатьПамять } from "../../../lib/pamyat-vitriny"

/**
 * Какие товары можно купить хоть в одном размере.
 *
 * Витрина прячет распроданные модели из каталога, разделов и поиска.
 * Спросить остатки вместе с товарами ей дорого: у каждой модели по три
 * десятка размеров, и Medusa считает доступность каждого через связи —
 * каталог грузился бы секунды. Здесь то же самое считаем напрямую по
 * складским уровням, одним проходом.
 *
 * Отдаём только id товаров. Ответ держим минуту: остатки склад заливает
 * пачками, точнее минуты витрине не нужно.
 */
const ДЕРЖИМ_МС = 60_000

let запомнили: { когда: number; ids: string[] } | null = null

// правка в админке или остатки склада — забываем сразу (lib/pamyat-vitriny.ts)
привязатьПамять(() => {
  запомнили = null
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (запомнили && Date.now() - запомнили.когда < ДЕРЖИМ_МС) {
    return res.json({ ids: запомнили.ids })
  }

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const inventory = req.scope.resolve(Modules.INVENTORY)

  try {
    const [{ data: варианты }, уровни] = await Promise.all([
      query.graph({
        entity: "product_variant",
        fields: [
          "id",
          "product_id",
          "manage_inventory",
          "allow_backorder",
          "inventory_items.inventory_item_id",
          "inventory_items.required_quantity",
        ],
        pagination: { take: 100_000 },
      }),
      inventory.listInventoryLevels(
        {},
        {
          select: ["inventory_item_id", "stocked_quantity", "reserved_quantity"],
          take: 100_000,
        }
      ),
    ])

    // Доступно по позиции склада — сумма по всем складам (склад у нас один)
    const доступно = new Map<string, number>()
    for (const у of уровни as any[]) {
      const свободно = Number(у.stocked_quantity ?? 0) - Number(у.reserved_quantity ?? 0)
      доступно.set(у.inventory_item_id, (доступно.get(у.inventory_item_id) ?? 0) + свободно)
    }

    const есть = new Set<string>()
    for (const в of варианты as any[]) {
      if (!в.product_id || есть.has(в.product_id)) {
        continue
      }

      const позиции = в.inventory_items ?? []
      const можноКупить =
        в.manage_inventory === false ||
        в.allow_backorder === true ||
        (позиции.length > 0 &&
          позиции.every(
            (п: any) =>
              (доступно.get(п.inventory_item_id) ?? 0) >= Number(п.required_quantity ?? 1)
          ))

      if (можноКупить) {
        есть.add(в.product_id)
      }
    }

    запомнили = { когда: Date.now(), ids: [...есть] }
    return res.json({ ids: запомнили.ids })
  } catch (ошибка: any) {
    logger.error(`Наличие для витрины не посчиталось — ${ошибка?.message}`)
    // Без ответа витрина покажет всё, как раньше: лучше лишняя карточка,
    // чем пустой каталог
    return res.status(500).json({ message: "Не удалось посчитать наличие" })
  }
}
