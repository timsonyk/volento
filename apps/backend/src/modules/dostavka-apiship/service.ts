import { AsyncLocalStorage } from "node:async_hooks"

import { КОДЫ } from "../../lib/sklad-kody"
import { безНомера, допУслуги, кодыПоАртикулу, поПарам, type ДопУслуга } from "../../lib/primerka"
import { ТЕСТ, тестоваяНаклейка } from "../../lib/sklad-test-metka"

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
 *
 * 3. Примерка и частичный выкуп (lib/primerka.ts). Каждая пара — своей
 *    строкой со своим кодом «Честного знака», и служба отвечает по каждой,
 *    взяли её или нет. Частичный выкуп заказываем у службы дополнительной
 *    услугой. Если служба с ней заказ не приняла, отправляем ещё раз без
 *    неё: посылка важнее примерки. Тогда в сборке остаётся пометка
 *    primerka_oshibka, а склад зовёт человека (lib/sklad-sborka.ts).
 *
 * И тестовые заказы склада (lib/sklad-test): в службу не ходим вовсе —
 * поддельный трек и наклейка, отмена тоже без ApiShip.
 */
type Заявка = {
  цены: Map<string, number>
  коды: Map<string, string[]>
  услуги: ДопУслуга[]
}

const заявка = new AsyncLocalStorage<Заявка>()

class DostavkaApishipService extends ApishipService {
  static identifier = ApishipService.identifier

  async createFulfillment(data: any, items: any[], order: any, fulfillment: any) {
    if (data?.[ТЕСТ]) {
      const номер = String(order?.display_id ?? order?.id ?? "")
      return {
        data: { test: true },
        labels: [
          {
            tracking_number: `TEST-${номер}`,
            tracking_url: "",
            label_url: тестоваяНаклейка(номер),
          },
        ],
      }
    }

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

    const коды = кодыПоАртикулу(
      заказ?.items ?? [],
      (order?.metadata ?? {})[КОДЫ] ?? {},
      собрано.size ? new Set(собрано.keys()) : undefined
    )
    const выбор = data?.apishipData
    const услуги = допУслуги(выбор?.tariff?.providerKey, выбор?.point)
    const отправить = (с: ДопУслуга[]) =>
      заявка.run({ цены: поАртикулу, коды, услуги: с }, () =>
        super.createFulfillment(data, items, заказ, fulfillment)
      )

    if (!услуги.length) {
      return отправить([])
    }

    try {
      const итог = await отправить(услуги)
      return { ...итог, data: { ...(итог?.data ?? {}), primerka: true } }
    } catch (ошибка: any) {
      this.logger_?.warn?.(
        `ApiShip не принял заказ ${order?.display_id} с частичным выкупом (${ошибка?.message}), отправляем без него`
      )
      const итог = await отправить([])
      return {
        ...итог,
        data: { ...(итог?.data ?? {}), primerka: false, primerka_oshibka: String(ошибка?.message ?? ошибка).slice(0, 300) },
      }
    }
  }

  async cancelFulfillment(data: any) {
    if (data?.test) {
      return {}
    }
    return super.cancelFulfillment(data)
  }

  async callApishipApi_(имя: string, запрос: any, вызов: () => Promise<any>) {
    const наша = заявка.getStore()

    // Запрос и вызов держат один и тот же объект — правка уходит в ApiShip
    if (имя === "ordersApi.addOrder" && наша && запрос?.orderRequest) {
      const з = запрос.orderRequest
      let всего = 0

      for (const место of з.places ?? []) {
        место.items = поПарам(место.items ?? [], наша.коды)
        for (const п of место.items) {
          if (наша.цены.size) {
            п.assessedCost = наша.цены.get(безНомера(п.articul)) ?? 0
          }
          всего += Number(п.assessedCost ?? 0) * Number(п.quantity ?? 0)
        }
      }

      if (наша.цены.size) {
        з.cost = { ...(з.cost ?? {}), assessedCost: всего }
      }
      // правим на месте, без новых объектов: вызов держит этот же запрос
      з.extraParams = наша.услуги.length ? наша.услуги : undefined
    }

    return super.callApishipApi_(имя, запрос, вызов)
  }
}

export default DostavkaApishipService
