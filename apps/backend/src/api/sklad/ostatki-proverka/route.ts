import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Что у нас сейчас записано по остаткам — склад сверяется с этим.
 *
 * Ключ проверяется там же, где у всего /sklad/*: в api/middlewares.ts.
 *
 * kolichestvo — ровно то число, которое склад присылал бы нам сейчас:
 * доступное к продаже. Физический остаток и наш резерв хранятся порознь
 * (см. физическийОстаток), складу их разбивка ни к чему — ему важно
 * сравнить со своим.
 *
 * Весь каталог — 13 тысяч позиций, за один раз отдаём страницу.
 *
 * Заодно — что это за позиция у нас: название, цвет, размер, рост. Склад
 * просил «список товаров»; отдельный адрес для этого не нужен, это тот
 * же список.
 */
const СТРАНИЦА = 2000

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const inventory = req.scope.resolve(Modules.INVENTORY)
  const stockLocation = req.scope.resolve(Modules.STOCK_LOCATION)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const артикул = String(req.query.artikul ?? "").trim()
  const сдвиг = Math.max(0, Math.trunc(Number(req.query.offset ?? 0)) || 0)

  try {
    const склады = await stockLocation.listStockLocations({}, { take: 2 })

    if (склады.length !== 1) {
      logger.error(`Складов ${склады.length}, ожидался один — обмен остановлен`)
      return res.status(500).json({ ошибка: "Склад не определён" })
    }

    const [позиции, всего] = await inventory.listAndCountInventoryItems(
      артикул ? { sku: артикул } : {},
      {
        select: ["id", "sku"],
        order: { sku: "ASC" },
        skip: артикул ? 0 : сдвиг,
        take: артикул ? 1 : СТРАНИЦА,
      }
    )

    const уровни = позиции.length
      ? await inventory.listInventoryLevels(
          {
            inventory_item_id: позиции.map((п: any) => п.id),
            location_id: склады[0].id,
          },
          {
            select: ["inventory_item_id", "stocked_quantity", "reserved_quantity"],
            take: позиции.length,
          }
        )
      : []

    const поПозиции = new Map(уровни.map((у: any) => [у.inventory_item_id, у]))

    const { data: связи } = позиции.length
      ? await query.graph({
          entity: "inventory_item",
          fields: [
            "id",
            "variants.options.value",
            "variants.options.option.title",
            "variants.product.title",
            "variants.product.metadata",
          ],
          filters: { id: позиции.map((п: any) => п.id) },
        })
      : { data: [] as any[] }

    type Описание = {
      nazvanie: string | null
      cvet: string | null
      razmer: string | null
      rost: string | null
    }
    const описание = new Map<string, Описание>(
      связи.map((с: any): [string, Описание] => {
        const вариант = с.variants?.[0]
        const товар = вариант?.product
        const цвет = String(товар?.metadata?.color ?? "").trim() || null
        const опция = (слово: RegExp) =>
          вариант?.options?.find((о: any) => слово.test(о.option?.title ?? ""))
            ?.value ?? null
        // В названии цвет — хвостом: «Брюки палаццо, бежевый». Цвет
        // отдаём отдельным полем, из названия его убираем.
        let название = String(товар?.title ?? "").trim() || null
        if (название && цвет && название.toLowerCase().endsWith(`, ${цвет.toLowerCase()}`)) {
          название = название.slice(0, -(цвет.length + 2))
        }
        return [
          с.id,
          {
            nazvanie: название,
            cvet: цвет,
            razmer: опция(/размер/i),
            rost: опция(/рост/i),
          },
        ]
      })
    )

    const ostatki = позиции
      .filter((п: any) => п.sku)
      .map((п: any) => {
        const у: any = поПозиции.get(п.id)
        const физически = Number(у?.stocked_quantity ?? 0)
        const резерв = Number(у?.reserved_quantity ?? 0)
        return {
          artikul: п.sku,
          ...(описание.get(п.id) ?? { nazvanie: null, cvet: null, razmer: null, rost: null }),
          kolichestvo: Math.max(0, физически - резерв),
          // заказы, которые мы уже продали, а склад ещё не взял в сборку
          v_rezerve: резерв,
        }
      })

    if (артикул) {
      return ostatki.length
        ? res.json({ ostatki })
        : res.status(404).json({ ошибка: "Артикула нет в нашем каталоге" })
    }

    return res.json({ ostatki, vsego: всего, offset: сдвиг, limit: СТРАНИЦА })
  } catch (ошибка: any) {
    logger.error(`Склад: сверка остатков не прошла — ${ошибка?.message}`)
    return res.status(500).json({ ошибка: "Не удалось прочитать остатки" })
  }
}
