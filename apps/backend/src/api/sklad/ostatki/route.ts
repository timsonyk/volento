import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import {
  вНашАртикул,
  физическийОстаток,
  type ПозицияСклада,
} from "../../../lib/sklad-pozicii"

/**
 * Склад заливает остатки.
 *
 * Работает как «обновить остатки» у Озона и Вайлдберриза: одним
 * запросом абсолютные числа, сколько пар доступно прямо сейчас. Не
 * разница, не «списать одну» — именно текущее число. Поэтому любой
 * пропущенный запрос ничего не ломает: следующий всё выправит.
 *
 * Про то, почему мы пишем себе не присланное число, а присланное плюс
 * наш резерв, написано в физическийОстаток.
 */
/**
 * Сколько позиций принимаем за один запрос.
 *
 * Не наша прихоть: Medusa не берёт тело запроса больше сотни килобайт,
 * а это примерно две с половиной тысячи позиций. Заявляем две — с
 * запасом, чтобы склад не ловил 413 на длинных артикулах. Весь наш
 * каталог в 13 тысяч позиций уезжает семью запросами за 13 секунд.
 */
const ЗА_РАЗ = 2000

type Строка = ПозицияСклада & { kolichestvo?: number; quantity?: number }

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const inventory = req.scope.resolve(Modules.INVENTORY)
  const stockLocation = req.scope.resolve(Modules.STOCK_LOCATION)

  const тело = req.body as { ostatki?: Строка[] } | undefined
  const строки = Array.isArray(тело?.ostatki) ? тело!.ostatki! : []

  if (!строки.length) {
    return res.status(400).json({ ошибка: "Пустой список ostatki" })
  }

  if (строки.length > ЗА_РАЗ) {
    return res
      .status(400)
      .json({ ошибка: `За один раз не больше ${ЗА_РАЗ} позиций` })
  }

  // Склад у нас один. Берём его сами, чтобы складу не приходилось
  // помнить наш внутренний номер и присылать его в каждом запросе.
  const склады = await stockLocation.listStockLocations({}, { take: 2 })

  if (склады.length !== 1) {
    logger.error(`Складов ${склады.length}, ожидался один — обмен остановлен`)
    return res.status(500).json({ ошибка: "Склад не определён" })
  }

  const складИд = склады[0].id

  // Разбираем присланное: считаем нужное количество по артикулу. Один
  // артикул мог прийти дважды — берём последнее значение, как сделал бы
  // и сам склад, если бы слал их по очереди.
  const хотим = new Map<string, number>()
  const непонятные: Строка[] = []

  for (const строка of строки) {
    const артикул = вНашАртикул(строка)
    const сколько = Number(строка.kolichestvo ?? строка.quantity)

    if (!артикул || !Number.isFinite(сколько)) {
      непонятные.push(строка)
      continue
    }

    хотим.set(артикул, сколько)
  }

  if (!хотим.size) {
    return res.status(400).json({ ошибка: "Ни одну строку не разобрали", непонятные })
  }

  try {
    const артикулы = [...хотим.keys()]

    const позиции = await inventory.listInventoryItems(
      { sku: артикулы },
      { select: ["id", "sku"], take: артикулы.length }
    )

    const поАртикулу = new Map(позиции.map((п: any) => [п.sku, п.id]))
    const идыПозиций = позиции.map((п: any) => п.id)

    // Текущие уровни нужны ради резерва: без него мы бы записали
    // доступное как физическое и вычли бы наши же заказы дважды.
    const уровни = идыПозиций.length
      ? await inventory.listInventoryLevels(
          { inventory_item_id: идыПозиций, location_id: складИд },
          { select: ["inventory_item_id", "reserved_quantity"], take: идыПозиций.length }
        )
      : []

    const резервПоПозиции = new Map(
      уровни.map((у: any) => [у.inventory_item_id, Number(у.reserved_quantity ?? 0)])
    )

    const кОбновлению: {
      inventory_item_id: string
      location_id: string
      stocked_quantity: number
    }[] = []
    const неНашли: Строка[] = []

    for (const строка of строки) {
      const артикул = вНашАртикул(строка)
      if (!артикул || !хотим.has(артикул)) {
        continue
      }

      const идПозиции = поАртикулу.get(артикул)

      if (!идПозиции) {
        // Не ошибка: склад торгует шире, чем мы. Складу полезно видеть
        // список, чтобы заметить, если он вдруг разом вырос.
        неНашли.push(строка)
        continue
      }

      // Уровня может не быть, если позицию завели, а на складе ещё ни
      // разу не считали: тогда резерва точно нет.
      const резерв = резервПоПозиции.get(идПозиции) ?? 0

      кОбновлению.push({
        inventory_item_id: идПозиции,
        location_id: складИд,
        stocked_quantity: физическийОстаток(хотим.get(артикул)!, резерв),
      })
    }

    if (кОбновлению.length) {
      await inventory.updateInventoryLevels(кОбновлению)
    }

    return res.json({
      prinyato: кОбновлению.length,
      ne_nashli: неНашли,
      ...(непонятные.length ? { ne_razobrali: непонятные } : {}),
    })
  } catch (ошибка: any) {
    logger.error(`Склад: остатки не записались — ${ошибка?.message}`)
    // Отдаём 500 намеренно: склад повторит через минуту, а молча
    // «принять» и потерять остатки нельзя — витрина врала бы до утра.
    return res.status(500).json({ ошибка: "Не удалось записать остатки" })
  }
}
