import { ОШИБКА_ВХОДА, корзинаВошедшего, оплатаВошедшего, сессияВошедшего } from "../tolko-pokupatel"

/** Запрос с поддельным query.graph: корзины и сборы оплаты по id */
const запрос = (данные: { карзины?: Record<string, any>; сборы?: Record<string, any> }, части: any) => ({
  method: "POST",
  path: "/store/x",
  ...части,
  scope: {
    resolve: (имя: string) =>
      имя === "logger"
        ? { warn: () => {}, error: () => {} }
        : {
            graph: async ({ entity, filters }: any) => ({
              data: [(entity === "cart" ? данные.карзины : данные.сборы)?.[filters.id]].filter(Boolean),
            }),
          },
  },
})

const ответ = () => {
  const о: any = { код: 200, тело: null }
  о.status = (к: number) => ((о.код = к), о)
  о.json = (т: any) => ((о.тело = т), о)
  return о
}

const прогнать = async (мв: any, req: any) => {
  const res = ответ()
  let дальше = false
  await мв(req, res, () => (дальше = true))
  return { дальше, код: res.код, тело: res.тело }
}

const корзины = {
  гость: { id: "гость", customer: { id: "c1", has_account: false } },
  пусто: { id: "пусто", customer: null },
  свой: { id: "свой", customer: { id: "c2", has_account: true } },
}

describe("заказ только от вошедшего", () => {
  afterEach(() => delete process.env.ZAKAZ_BEZ_VHODA)

  it("оформление корзины: гость и корзина без покупателя — 401, вошедший — дальше", async () => {
    expect(await прогнать(корзинаВошедшего, запрос({ карзины: корзины }, { params: { id: "гость" } }))).toEqual({
      дальше: false,
      код: 401,
      тело: { message: ОШИБКА_ВХОДА },
    })
    expect((await прогнать(корзинаВошедшего, запрос({ карзины: корзины }, { params: { id: "пусто" } }))).код).toBe(401)
    expect((await прогнать(корзинаВошедшего, запрос({ карзины: корзины }, { params: { id: "свой" } }))).дальше).toBe(true)
  })

  it("оплата Точкой: корзина из тела", async () => {
    expect((await прогнать(оплатаВошедшего, запрос({ карзины: корзины }, { body: { cart_id: "гость" } }))).код).toBe(401)
    expect((await прогнать(оплатаВошедшего, запрос({ карзины: корзины }, { body: { cart_id: "свой" } }))).дальше).toBe(true)
  })

  it("сессия оплаты: корзина через сбор оплаты", async () => {
    const сборы = { pc1: { id: "pc1", cart: { id: "гость" } }, pc2: { id: "pc2", cart: { id: "свой" } } }
    expect((await прогнать(сессияВошедшего, запрос({ карзины: корзины, сборы }, { params: { id: "pc1" } }))).код).toBe(401)
    expect((await прогнать(сессияВошедшего, запрос({ карзины: корзины, сборы }, { params: { id: "pc2" } }))).дальше).toBe(true)
  })

  it("корзину не нашли — решает штатный обработчик", async () => {
    expect((await прогнать(оплатаВошедшего, запрос({ карзины: корзины }, { body: {} }))).дальше).toBe(true)
  })

  it("ZAKAZ_BEZ_VHODA=true снимает правило", async () => {
    process.env.ZAKAZ_BEZ_VHODA = "true"
    expect((await прогнать(корзинаВошедшего, запрос({ карзины: корзины }, { params: { id: "гость" } }))).дальше).toBe(true)
  })
})
