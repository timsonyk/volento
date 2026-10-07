// Плагин отдаёт класс провайдера только внутри описания модуля, отдельным
// путём его не достать — берём оттуда же, откуда его берёт Medusa.
const плагин = require("@gorgo/medusa-fulfillment-apiship/providers/fulfillment-apiship")
const ApishipService: any = (плагин.default ?? плагин).services[0]

/**
 * Провайдер ApiShip — плагин @gorgo/medusa-fulfillment-apiship с одной
 * поправкой.
 *
 * Плагин складывает в посылку все строки заказа, сколько бы их ни
 * собрали. Если склад собрал одну вещь из двух, в службу ушли бы обе:
 * в накладной и в оценке — пара, которой в коробке нет. Поэтому
 * перед отправкой оставляем в заказе только то, что в этой сборке, и в
 * том количестве, в каком собрано.
 *
 * Плагин не правим, а наследуемся — так же, как с Точкой
 * (modules/oplata-tochka): переживёт обновление, отличия в одном файле.
 */
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

    return super.createFulfillment(data, items, заказ, fulfillment)
  }
}

export default DostavkaApishipService
