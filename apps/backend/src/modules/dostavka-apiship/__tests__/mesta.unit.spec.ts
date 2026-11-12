import { ПАКЕТЫ } from "../../../lib/sklad-pakety"
import { КОДЫ } from "../../../lib/sklad-kody"
import { ТЕСТ } from "../../../lib/sklad-test-metka"
import DostavkaApishipService from "../service"

/**
 * Что уходит в ApiShip: плагин собирает запрос с одним местом, мы делим
 * его по пакетам склада. В сеть не ходим: вместо плагина — заглушка,
 * которая отдаёт его обычный запрос и запоминает, каким он ушёл.
 */
const К = (n: number) => `010460000000000021SER${n}\u001d93abcd`

const родитель = Object.getPrototypeOf(DostavkaApishipService.prototype)

const заказ = (пакеты?: any) => ({
  id: "order_1",
  display_id: 501,
  metadata: {
    [КОДЫ]: { s1: [К(1), К(2)], s2: [К(3)] },
    ...(пакеты ? { [ПАКЕТЫ]: пакеты } : {}),
  },
  items: [
    { id: "s1", quantity: 2, unit_price: 5000, variant: { sku: "3147-46/176" } },
    { id: "s2", quantity: 1, unit_price: 3000, variant: { sku: "5110-38" } },
  ],
})

const сборка = [
  { line_item_id: "s1", quantity: 2 },
  { line_item_id: "s2", quantity: 1 },
]

const ДВА = [
  { nomer: 1, sklad: "A", stroki: [{ id: "s1", quantity: 2, kody: [К(1), К(2)] }] },
  { nomer: 2, sklad: "B", stroki: [{ id: "s2", quantity: 1, kody: [К(3)] }] },
]

describe("места в заявке ApiShip", () => {
  let ушло: any

  const служба = () => {
    const с: any = Object.create(DostavkaApishipService.prototype)
    с.logger_ = { warn() {}, debug() {}, info() {}, error() {} }
    return с
  }

  beforeEach(() => {
    ушло = null
    jest.spyOn(родитель, "callApishipApi_").mockImplementation(async (_и: any, запрос: any) => {
      ушло = запрос.orderRequest
      return { data: { orderId: 1 } }
    })
    jest.spyOn(родитель, "createFulfillment").mockImplementation(async function (this: any) {
      const orderRequest = {
        order: { providerKey: "cdek", weight: 1300 },
        cost: { assessedCost: 0, codCost: 0 },
        places: [
          {
            height: 11,
            length: 30,
            width: 40,
            weight: 1300,
            items: [
              { articul: "3147-46/176", description: "Брюки", quantity: 2, weight: 450, height: 4, length: 30, width: 40, assessedCost: 0 },
              { articul: "5110-38", description: "Юбка", quantity: 1, weight: 400, height: 3, length: 30, width: 33, assessedCost: 0 },
            ],
          },
        ],
      }
      await this.callApishipApi_("ordersApi.addOrder", { orderRequest }, async () => ({}))
      return { data: { orderId: 1 }, labels: [] }
    })
  })

  afterEach(() => jest.restoreAllMocks())

  it("заказ не делили — одно место, размеры прежние", async () => {
    const итог = await служба().createFulfillment({ apishipData: { tariff: { providerKey: "cdek" } } }, сборка, заказ(), {})

    expect(ушло.places).toHaveLength(1)
    expect(ушло.places[0]).toMatchObject({ height: 11, length: 30, width: 40, weight: 1300 })
    expect(ушло.places[0].items).toHaveLength(3)
    expect(ушло.cost.assessedCost).toBe(13000)
    expect(итог.data.mest).toBe(1)
  })

  it("два пакета — два места, у каждого свои товары, вес и размеры", async () => {
    const итог = await служба().createFulfillment({ apishipData: { tariff: { providerKey: "cdek" } } }, сборка, заказ(ДВА), {})

    expect(ушло.places).toHaveLength(2)
    expect(ушло.places[0]).toMatchObject({ placeNumber: "1", height: 8, weight: 900 })
    expect(ушло.places[0].items.map((т: any) => т.articul)).toEqual(["3147-46/176#1", "3147-46/176#2"])
    expect(ушло.places[1]).toMatchObject({ placeNumber: "2", height: 3, weight: 400 })
    expect(ушло.places[1].items.map((т: any) => т.markCode)).toEqual([К(3)])
    // оценка и вес — по всему заказу, как и раньше
    expect(ушло.cost.assessedCost).toBe(13000)
    expect(ушло.order.weight).toBe(1300)
    // частичный выкуп заказываем и для нескольких мест
    expect(ушло.extraParams).toEqual([{ key: "cdek.PartialDelivery", value: "1" }])
    expect(итог.data).toMatchObject({ mest: 2, primerka: true })
  })

  it("пакеты не сходятся со сборкой — едет одним местом", async () => {
    await служба().createFulfillment({}, [сборка[0]], заказ(ДВА), {})
    expect(ушло.places).toHaveLength(1)
  })

  it("тестовый заказ: в службу не ходим, наклеек — по числу пакетов", async () => {
    const итог = await служба().createFulfillment({ [ТЕСТ]: true }, сборка, заказ(ДВА), {})
    expect(ушло).toBeNull()
    expect(итог.data).toEqual({ test: true, mest: 2 })
    expect(итог.labels[0].label_url).toMatch(/^data:application\/pdf/)
  })
})
