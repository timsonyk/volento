import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { забытьПлощадки } from "../chz"
import { ЧЕКИ, отправить, чекПредоплаты, чекРасчёта, type Чек } from "../kassa"
import { АТОЛ, КОД_1, КОД_2, ЧЗ, ответПоКоду, подменитьСеть, type Ответ } from "./mok-seti"

/**
 * Путь «полного расчёта» через кассу: склад прислал коды, мы проверили их
 * в ЧЗ и отдали чек Атолу. Сеть, база и почта — поддельные.
 */

const ГРУППА = "grp_test"

function поддельныйЗаказ() {
  const предоплата: Чек = {
    id: "volento-7-predoplata",
    vid: "predoplata",
    operaciya: "sell",
    stroki: [
      { id: "item_1", kolichestvo: 2, cena: 5000 },
      { id: "dostavka", kolichestvo: 1, cena: 300 },
    ],
    telo: {},
    status: "done",
    popytok: 1,
    sozdan: "2026-10-20T10:00:00.000Z",
  }

  return {
    id: "order_1",
    display_id: 7,
    email: "pokupatel@example.com",
    total: 10300,
    metadata: { [ЧЕКИ]: [предоплата] } as Record<string, any>,
    items: [
      { id: "item_1", title: "Брюки", variant_title: "38/158", quantity: 2, total: 10000, unit_price: 5000 },
    ],
    shipping_methods: [{ total: 300, amount: 300 }],
    shipping_address: { phone: "+70000000000" },
    payment_collections: [
      { payments: [{ provider_id: "pp_tochka_tochka", captured_at: "2026-10-20", canceled_at: null }] },
    ],
  }
}

function поддельныйКонтейнер(заказ: ReturnType<typeof поддельныйЗаказ>) {
  const журнал = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const уведомления = { createNotifications: jest.fn() }

  const службы: Record<string, unknown> = {
    [ContainerRegistrationKeys.LOGGER]: журнал,
    [ContainerRegistrationKeys.QUERY]: { graph: async () => ({ data: [заказ] }) },
    [Modules.ORDER]: {
      listOrders: async () => [заказ],
      updateOrders: async ([правка]: any[]) => {
        // как настоящая база: храним копию, а не ссылку
        заказ.metadata = JSON.parse(JSON.stringify(правка.metadata))
      },
    },
    [Modules.NOTIFICATION]: уведомления,
  }

  return {
    scope: { resolve: (ключ: string) => службы[ключ] } as any,
    журнал,
    уведомления,
  }
}

const чекиЗаказа = (заказ: { metadata: Record<string, any> }): Чек[] => заказ.metadata[ЧЕКИ]
const расчёт = (заказ: { metadata: Record<string, any> }) =>
  чекиЗаказа(заказ).find((ч) => ч.vid === "raschet")!

type ЧестныйЗнак = (тело: any) => Ответ

const хорошийЧЗ: ЧестныйЗнак = (тело) => ({
  body: {
    code: 0,
    codes: тело.codes.map((к: string) => ответПоКоду(к)),
    reqId: "2ce10bdb-6510-4d37-be04-dd473b98c728",
    reqTimestamp: 1692691702065,
  },
})

/** Сеть: Атол принимает всё, ЧЗ отвечает как скажет тест. */
function сеть(чз: ЧестныйЗнак, атол: () => Ответ = () => ({ body: { uuid: "atol-uuid-1" } })) {
  return подменитьСеть((адрес, тело) => {
    if (адрес === `${АТОЛ}/getToken`) {
      return { body: { token: "atol-token" } }
    }
    if (адрес.startsWith(`${АТОЛ}/${ГРУППА}/`)) {
      return атол()
    }
    if (адрес === `${ЧЗ}/api/v4/true-api/cdn/info`) {
      return { body: { code: 0, hosts: [{ host: "https://cdn1.test" }] } }
    }
    if (адрес.endsWith("/cdn/health/check")) {
      return { body: { code: 0, avgTimeMs: 5 } }
    }
    if (адрес.endsWith("/codes/check")) {
      return чз(тело)
    }
    throw new Error(`неожиданный адрес ${адрес}`)
  })
}

const собрано = [{ id: "item_1", quantity: 2, kody: [КОД_1, КОД_2] }]

const ОКРУЖЕНИЕ = { ...process.env }

beforeEach(() => {
  process.env = {
    ...ОКРУЖЕНИЕ,
    ATOL_URL: АТОЛ,
    ATOL_LOGIN: "login",
    ATOL_PASSWORD: "pass",
    ATOL_GROUP_CODE: ГРУППА,
    ATOL_INN: "5544332219",
    ATOL_PAYMENT_ADDRESS: "volento.test",
    CHZ_TOKEN: "test-token",
    CHZ_URL: ЧЗ,
  }
  delete process.env.KASSA_PROVERKA_KM
  delete process.env.ATOL_TSPIOT
  delete process.env.ATOL_LYUBAYA_OPLATA
  забытьПлощадки()
})

afterEach(() => {
  jest.restoreAllMocks()
  process.env = ОКРУЖЕНИЕ
})

const вАтол = (вызовы: { адрес: string; тело: any }[]) =>
  вызовы.filter((в) => в.адрес.startsWith(`${АТОЛ}/${ГРУППА}/`))
const вЧЗ = (вызовы: { адрес: string }[]) => вызовы.filter((в) => в.адрес.endsWith("/codes/check"))

describe("полный расчёт, проверяем сами (chz)", () => {
  it("коды проверены — в Атол уходит чек с реквизитом 1260 при каждом коде", async () => {
    const заказ = поддельныйЗаказ()
    const { scope } = поддельныйКонтейнер(заказ)
    const { вызовы } = сеть(хорошийЧЗ)

    await чекРасчёта(scope, заказ.id, "ful_1", собрано)

    const [атол] = вАтол(вызовы)
    expect(атол.адрес).toBe(`${АТОЛ}/${ГРУППА}/sell`)
    expect(атол.тело.use_tspiot).toBeUndefined()
    expect(атол.тело.permissive_mode).toBeUndefined()

    const сКодами = атол.тело.receipt.items.filter((п: any) => п.mark_code)
    expect(сКодами).toHaveLength(2)
    for (const п of сКодами) {
      expect(п.sectoral_item_props).toEqual([
        {
          federal_id: "030",
          date: "21.11.2023",
          number: "1944",
          value: "UUID=2ce10bdb-6510-4d37-be04-dd473b98c728&Time=1692691702065",
        },
      ])
    }
    // у доставки кода нет — и реквизита нет
    const доставка = атол.тело.receipt.items.find((п: any) => п.payment_object === 4)
    expect(доставка.sectoral_item_props).toBeUndefined()

    const ч = расчёт(заказ)
    expect(ч.status).toBe("wait")
    expect(ч.proverka?.kody).toHaveLength(2)
    // в заказ коды проверки пишем без криптохвоста
    expect(JSON.stringify(ч.proverka)).not.toContain("93dGVz")
  })

  it("ЧЗ запретил продажу — чек не бьём, зовём человека", async () => {
    const заказ = поддельныйЗаказ()
    const { scope, уведомления } = поддельныйКонтейнер(заказ)
    const { вызовы } = сеть((тело) => ({
      body: {
        code: 0,
        codes: [ответПоКоду(тело.codes[0]), ответПоКоду(тело.codes[1], { sold: true })],
        reqId: "r",
        reqTimestamp: 1,
      },
    }))

    await чекРасчёта(scope, заказ.id, "ful_1", собрано)

    expect(вАтол(вызовы)).toHaveLength(0)
    const ч = расчёт(заказ)
    expect(ч.status).toBe("fail")
    expect(ч.oshibka).toContain("выведен из оборота")
    expect(уведомления.createNotifications).toHaveBeenCalledTimes(1)
  })

  it("ЧЗ не отвечает — чек ждёт в очереди, Атол не трогаем", async () => {
    const заказ = поддельныйЗаказ()
    const { scope, журнал } = поддельныйКонтейнер(заказ)
    const { вызовы } = сеть(() => ({ status: 503, body: {} }))

    await чекРасчёта(scope, заказ.id, "ful_1", собрано)

    expect(вАтол(вызовы)).toHaveLength(0)
    const ч = расчёт(заказ)
    expect(ч.status).toBe("novyy")
    expect(ч.popytok).toBe(1)
    expect(ч.oshibka).toContain("Честный знак")
    expect(журнал.warn).toHaveBeenCalled()
  })

  it("ЧЗ ожил — сторож отправляет чек со второй попытки", async () => {
    const заказ = поддельныйЗаказ()
    const { scope } = поддельныйКонтейнер(заказ)
    сеть(() => new Error("ECONNREFUSED"))
    await чекРасчёта(scope, заказ.id, "ful_1", собрано)
    jest.restoreAllMocks()

    забытьПлощадки()
    const { вызовы } = сеть(хорошийЧЗ)
    await отправить(scope, заказ.id, расчёт(заказ))

    expect(вАтол(вызовы)).toHaveLength(1)
    expect(расчёт(заказ).status).toBe("wait")
  })

  it("токен не принят — пишем в журнал как ошибку", async () => {
    const заказ = поддельныйЗаказ()
    const { scope, журнал } = поддельныйКонтейнер(заказ)
    сеть(() => ({ status: 401, body: {} }))

    await чекРасчёта(scope, заказ.id, "ful_1", собрано)

    expect(журнал.error).toHaveBeenCalledWith(expect.stringContaining("токен"))
    expect(расчёт(заказ).status).toBe("novyy")
  })

  it("аварийный режим ЧЗ — бьём без реквизита, отметку храним", async () => {
    const заказ = поддельныйЗаказ()
    const { scope } = поддельныйКонтейнер(заказ)
    const { вызовы } = сеть(() => ({ status: 203, body: {} }))

    await чекРасчёта(scope, заказ.id, "ful_1", собрано)

    const [атол] = вАтол(вызовы)
    expect(атол.тело.receipt.items.every((п: any) => !п.sectoral_item_props)).toBe(true)
    expect(расчёт(заказ).proverka?.avariya).toBe(true)
  })

  it("Атол не ответил — повтор уходит с той же проверкой, ЧЗ не спрашиваем", async () => {
    const заказ = поддельныйЗаказ()
    const { scope } = поддельныйКонтейнер(заказ)
    сеть(хорошийЧЗ, () => new Error("ETIMEDOUT"))
    await чекРасчёта(scope, заказ.id, "ful_1", собрано)
    expect(расчёт(заказ).status).toBe("novyy")
    jest.restoreAllMocks()

    const { вызовы } = сеть(() => new Error("в ЧЗ ходить не должны"))
    await отправить(scope, заказ.id, расчёт(заказ))

    expect(вЧЗ(вызовы)).toHaveLength(0)
    const [атол] = вАтол(вызовы)
    expect(атол.тело.receipt.items[0].sectoral_item_props[0].value).toContain("UUID=2ce10bdb")
    expect(расчёт(заказ).status).toBe("wait")
  })
})

describe("переключатель", () => {
  it("tspiot — в ЧЗ не ходим, Атолу ставим use_tspiot и permissive_mode", async () => {
    process.env.KASSA_PROVERKA_KM = "tspiot"
    const заказ = поддельныйЗаказ()
    const { scope } = поддельныйКонтейнер(заказ)
    const { вызовы } = сеть(() => new Error("в ЧЗ ходить не должны"))

    await чекРасчёта(scope, заказ.id, "ful_1", собрано)

    expect(вЧЗ(вызовы)).toHaveLength(0)
    const [атол] = вАтол(вызовы)
    expect(атол.тело.use_tspiot).toBe(true)
    expect(атол.тело.permissive_mode).toBe(true)
    expect(атол.тело.receipt.items.every((п: any) => !п.sectoral_item_props)).toBe(true)
  })

  it("чек, записанный до переключения на tspiot, уходит уже по новой схеме", async () => {
    const заказ = поддельныйЗаказ()
    const { scope } = поддельныйКонтейнер(заказ)
    сеть(() => new Error("ЧЗ лежит"))
    await чекРасчёта(scope, заказ.id, "ful_1", собрано)
    jest.restoreAllMocks()

    process.env.KASSA_PROVERKA_KM = "tspiot"
    const { вызовы } = сеть(() => new Error("в ЧЗ ходить не должны"))
    await отправить(scope, заказ.id, расчёт(заказ))

    const [атол] = вАтол(вызовы)
    expect(атол.тело.use_tspiot).toBe(true)
  })

  it("net — коды уходят без проверки (только для тестов)", async () => {
    process.env.KASSA_PROVERKA_KM = "net"
    const заказ = поддельныйЗаказ()
    const { scope } = поддельныйКонтейнер(заказ)
    const { вызовы } = сеть(() => new Error("в ЧЗ ходить не должны"))

    await чекРасчёта(scope, заказ.id, "ful_1", собрано)

    expect(вЧЗ(вызовы)).toHaveLength(0)
    expect(вАтол(вызовы)).toHaveLength(1)
  })
})

describe("чек предоплаты", () => {
  it("кодов в нём нет — в ЧЗ не ходим", async () => {
    const заказ = поддельныйЗаказ()
    заказ.metadata = {}
    const { scope } = поддельныйКонтейнер(заказ)
    const { вызовы } = сеть(() => new Error("в ЧЗ ходить не должны"))

    await чекПредоплаты(scope, заказ.id)

    expect(вЧЗ(вызовы)).toHaveLength(0)
    const [атол] = вАтол(вызовы)
    expect(атол.тело.receipt.items.every((п: any) => п.payment_method === "full_prepayment")).toBe(true)
    expect(атол.тело.use_tspiot).toBeUndefined()
  })
})
