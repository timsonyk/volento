import { AsyncLocalStorage } from "node:async_hooks"

import { КОДЫ } from "../../lib/sklad-kody"
import { безНомера, допУслуги, кодыПоАртикулу, поПарам, type ДопУслуга } from "../../lib/primerka"
import { ПАКЕТЫ, пакетыСборки, разложитьПоМестам, type Пакет } from "../../lib/sklad-pakety"
import { ТЕСТ, тестоваяНаклейка } from "../../lib/sklad-test-metka"
import { размерыМеста } from "../../lib/upakovka-tablica"

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
 * 4. Без города не считаем. Оформление открывается до выбора города, и
 *    Medusa сразу просит цену — ApiShip отвечал «ошибка валидации», а
 *    каждый такой запрос шёл в счёт бесплатных расчётов. Ответ для
 *    покупателя тот же: цена появится после выбора доставки.
 *
 * 5. Несколько мест (lib/sklad-pakety.ts). Склад может разделить заказ на
 *    пакеты — тогда в службу уходит одно отправление из нескольких мест,
 *    у каждого свои товары, вес и размеры. Размеры любого места, и
 *    единственного тоже, — из таблицы упаковки (lib/upakovka-tablica.ts).
 *
 * И тестовые заказы склада (lib/sklad-test): в службу не ходим вовсе —
 * поддельный трек и наклейка, отмена тоже без ApiShip.
 */
type Заявка = {
  цены: Map<string, number>
  коды: Map<string, string[]>
  услуги: ДопУслуга[]
  пакеты: Пакет[]
  артикулСтроки: Map<string, string>
}

const заявка = new AsyncLocalStorage<Заявка>()

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
    const пакеты = пакетыСборки((order?.metadata ?? {})[ПАКЕТЫ], собрано)
    const мест = Math.max(1, пакеты.length)

    if (data?.[ТЕСТ]) {
      const номер = String(order?.display_id ?? order?.id ?? "")
      return {
        data: { test: true, mest: мест },
        labels: [
          {
            tracking_number: `TEST-${номер}`,
            tracking_url: "",
            label_url: тестоваяНаклейка(номер, мест),
          },
        ],
      }
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
    const артикулСтроки = new Map<string, string>()
    for (const т of заказ?.items ?? []) {
      const артикул = т.variant?.sku
      if (артикул) {
        поАртикулу.set(артикул, Number(т.unit_price ?? 0))
        артикулСтроки.set(т.id, артикул)
      }
    }

    const коды = кодыПоАртикулу(
      заказ?.items ?? [],
      (order?.metadata ?? {})[КОДЫ] ?? {},
      собрано.size ? new Set(собрано.keys()) : undefined
    )
    const выбор = data?.apishipData
    const услуги = допУслуги(выбор?.tariff?.providerKey, выбор?.point)
    const отправить = async (с: ДопУслуга[]) => {
      const итог = await заявка.run(
        { цены: поАртикулу, коды, услуги: с, пакеты, артикулСтроки },
        () => super.createFulfillment(data, items, заказ, fulfillment)
      )
      // сколько мест заявили — по этому числу склад ждёт наклеек
      return { ...итог, data: { ...(итог?.data ?? {}), mest: мест } }
    }

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

  async calculatePrice(optionData: any, data: any, context: any) {
    if (!String(context?.shipping_address?.city ?? "").trim()) {
      throw new Error("Город не выбран — цену доставки посчитаем после выбора")
    }
    const цена = await super.calculatePrice(optionData, data, context)
    // Целые рубли. Служба присылает цену с копейками (304,99 ₽), витрина
    // в списке тарифов показывает её округлённой (305 ₽), а в итог заказа
    // попадало 304,99: покупатель видел две разные цены одной доставки.
    // Округляем так же, как витрина (ценаСтрокой), — цифры сходятся.
    const сумма = Number((цена as any)?.calculated_amount)
    return Number.isFinite(сумма)
      ? { ...цена, calculated_amount: Math.round(сумма) }
      : цена
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

      // Плагин кладёт всё в одно место. Сначала пары — номера у одинаковых
      // сквозные по заказу, — потом места: по пакетам склада или одно.
      const [первое] = з.places ?? []
      if (первое) {
        const пары = поПарам(первое.items ?? [], наша.коды)
        з.places =
          наша.пакеты.length > 1
            ? разложитьПоМестам(первое, пары, наша.пакеты, наша.артикулСтроки)
            : [{ ...первое, ...размерыМеста(пары), items: пары }]
        const вес = з.places.reduce((с: number, м: any) => с + Number(м.weight ?? 0), 0)
        if (з.order && вес > 0) {
          з.order.weight = вес
        }
      }

      for (const место of з.places ?? []) {
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
