import { AsyncLocalStorage } from "node:async_hooks"

// Плагин отдаёт класс провайдера только внутри описания модуля, отдельным
// путём его не достать — берём оттуда же, откуда его берёт Medusa.
const плагин = require("@gorgo/medusa-fulfillment-apiship/providers/fulfillment-apiship")
const ApishipService: any = (плагин.default ?? плагин).services[0]

/**
 * Провайдер ApiShip — плагин @gorgo/medusa-fulfillment-apiship с двумя
 * поправками. Плагин не правим, а наследуемся — так же, как с Точкой
 * (modules/oplata-tochka): переживёт обновление, отличия в одном файле.
 *
 * 1. Только собранное. Плагин складывает в посылку все строки заказа,
 *    сколько бы их ни собрали. Если склад собрал одну вещь из двух, в
 *    службу ушли бы обе — в накладной и в оценке пара, которой в коробке
 *    нет. Оставляем только то, что в этой сборке, и в собранном
 *    количестве.
 *
 * 2. Оценочная стоимость. Плагин ставит её равной нулю, если не включена
 *    оплата при получении (у нас не включена: платят на сайте). С нулевой
 *    оценкой посылка не застрахована — потеряют, служба возместит ноль.
 *    Ставим настоящую цену вещей; страховка у Яндекса — 0,5% от неё.
 *    Сумма к оплате при получении (cost, codCost) остаётся нулём.
 */
const цены = new AsyncLocalStorage<Map<string, number>>()

class DostavkaApishipService extends ApishipService {
  static identifier = ApishipService.identifier

  async createFulfillment(data: any, items: any[], order: any, fulfillment: any) {
    const собрано = new Map<string, number>()
    for (const п of items ?? []) {
      if (!п?.line_item_id) {
        continue
      }
      собрано.set(
        п.line_item_id,
        (собрано.get(п.line_item_id) ?? 0) + Number(п.quantity ?? 0)
      )
    }

    const заказ = собрано.size
      ? {
          ...order,
          items: (order?.items ?? [])
            .filter((т: any) => (собрано.get(т.id) ?? 0) > 0)
            .map((т: any) => ({ ...т, quantity: собрано.get(т.id) })),
        }
      : order

    // Цена штуки по артикулу — так строки посылки названы в запросе плагина
    const поАртикулу = new Map<string, number>()
    for (const т of заказ?.items ?? []) {
      const артикул = т.variant?.sku
      if (артикул) {
        поАртикулу.set(артикул, Number(т.unit_price ?? 0))
      }
    }

    return цены.run(поАртикулу, () =>
      super.createFulfillment(data, items, заказ, fulfillment)
    )
  }

  async callApishipApi_(имя: string, запрос: any, вызов: () => Promise<any>) {
    const поАртикулу = цены.getStore()

    // Запрос и вызов держат один и тот же объект — правка уходит в ApiShip
    if (имя === "ordersApi.addOrder" && поАртикулу?.size && запрос?.orderRequest) {
      const заявка = запрос.orderRequest
      let всего = 0

      for (const место of заявка.places ?? []) {
        for (const п of место.items ?? []) {
          const цена = поАртикулу.get(п.articul) ?? 0
          п.assessedCost = цена
          всего += цена * Number(п.quantity ?? 0)
        }
      }

      заявка.cost = { ...(заявка.cost ?? {}), assessedCost: всего }
    }

    return super.callApishipApi_(имя, запрос, вызов)
  }
}

export default DostavkaApishipService
