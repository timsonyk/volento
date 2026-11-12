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
 *
 * Считаем одним запросом к базе: через связи Medusa те же 10 тысяч
 * размеров собирались 3,5 секунды, и раз в минуту главная с каталогом
 * открывались на эти секунды дольше. Запрос — 0,06 секунды. Если он не
 * прошёл (после обновления Medusa таблицы могли смениться), считаем
 * прежним, медленным способом.
 */
const ЗАПРОС = `
  with u as (
    select inventory_item_id, sum(stocked_quantity - reserved_quantity) as svobodno
    from inventory_level where deleted_at is null group by 1
  ),
  p as (
    select l.variant_id, bool_and(coalesce(u.svobodno, 0) >= l.required_quantity) as ok
    from product_variant_inventory_item l
    left join u on u.inventory_item_id = l.inventory_item_id
    where l.deleted_at is null group by 1
  )
  select distinct v.product_id as id
  from product_variant v left join p on p.variant_id = v.id
  where v.deleted_at is null and v.product_id is not null
    and (v.manage_inventory = false or v.allow_backorder = true or p.ok)
`
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
    const база: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const { rows } = await база.raw(ЗАПРОС)
    запомнили = { когда: Date.now(), ids: rows.map((р: any) => String(р.id)) }
    return res.json({ ids: запомнили.ids })
  } catch (ошибка: any) {
    logger.warn(`Наличие прямым запросом не посчиталось (${ошибка?.message}), считаем через связи`)
  }

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
