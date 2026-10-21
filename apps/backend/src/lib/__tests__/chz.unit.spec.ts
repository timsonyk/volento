import {
  забытьПлощадки,
  отраслевойРеквизит,
  причинаЗапрета,
  проверитьКоды,
  режимПроверки,
} from "../chz"
import { КОД_1, КОД_2, ЧЗ, ответПоКоду, подменитьСеть, type Обработчик } from "./mok-seti"

const ПЛОЩАДКИ = ["https://cdn1.test", "https://cdn2.test"]

/** ЧЗ, у которого всё хорошо, кроме того, что задаст тест. */
const честныйЗнак =
  (проверка: (площадка: string, тело: any) => any): Обработчик =>
  (адрес, тело) => {
    if (адрес === `${ЧЗ}/api/v4/true-api/cdn/info`) {
      return { body: { code: 0, description: "ok", hosts: ПЛОЩАДКИ.map((host) => ({ host })) } }
    }
    if (адрес.endsWith("/api/v4/true-api/cdn/health/check")) {
      return { body: { code: 0, description: "ok", avgTimeMs: 5 } }
    }
    if (адрес.endsWith("/api/v4/true-api/codes/check")) {
      return проверка(адрес.replace("/api/v4/true-api/codes/check", ""), тело)
    }
    throw new Error(`неожиданный адрес ${адрес}`)
  }

const всёХорошо = (_: string, тело: any) => ({
  body: {
    code: 0,
    description: "ok",
    codes: тело.codes.map((к: string) => ответПоКоду(к)),
    reqId: "2ce10bdb-6510-4d37-be04-dd473b98c728",
    reqTimestamp: 1692691702065,
  },
})

const ОКРУЖЕНИЕ = { ...process.env }

beforeEach(() => {
  process.env = { ...ОКРУЖЕНИЕ, CHZ_TOKEN: "test-token", CHZ_URL: ЧЗ, CHZ_FN: "7380440903872060" }
  delete process.env.KASSA_PROVERKA_KM
  delete process.env.ATOL_TSPIOT
  забытьПлощадки()
})

afterEach(() => {
  jest.restoreAllMocks()
  process.env = ОКРУЖЕНИЕ
})

describe("переключатель", () => {
  it("явный выбор главнее всего", () => {
    process.env.KASSA_PROVERKA_KM = "tspiot"
    expect(режимПроверки()).toBe("tspiot")
  })

  it("ATOL_TSPIOT=true, как раньше, — значит ТС ПИоТ", () => {
    process.env.ATOL_TSPIOT = "true"
    expect(режимПроверки()).toBe("tspiot")
  })

  it("есть токен — проверяем сами, нет — не проверяем", () => {
    expect(режимПроверки()).toBe("chz")
    delete process.env.CHZ_TOKEN
    expect(режимПроверки()).toBe("net")
  })

  it("непонятное значение не включает ничего странного", () => {
    process.env.KASSA_PROVERKA_KM = "da"
    expect(режимПроверки()).toBe("chz")
  })
})

describe("реквизит 1260", () => {
  it("030, 21.11.2023, 1944 и UUID=…&Time=…", () => {
    expect(отраслевойРеквизит("abc", 123)).toEqual({
      federal_id: "030",
      date: "21.11.2023",
      number: "1944",
      value: "UUID=abc&Time=123",
    })
  })
})

describe("случаи запрета", () => {
  const к = (поля: Record<string, unknown>) => причинаЗапрета(ответПоКоду(КОД_1, поля) as any, true)

  it("хороший код можно продавать", () => {
    expect(к({})).toBeNull()
  })

  it.each([
    [{ found: false, errorCode: 10 }, "нет в Честном знаке"],
    [{ valid: false }, "структура"],
    [{ verified: false }, "криптоподписи"],
    [{ utilised: false }, "нанесении"],
    [{ isBlocked: true, ogvs: ["RPN"] }, "RPN"],
    [{ sold: true }, "выведен из оборота"],
    [{ realizable: false }, "не введён в оборот"],
    [{ errorCode: 5 }, "ошибку 5"],
    [{ isOwner: false }, "другому продавцу"],
  ])("%j — нельзя", (поля, причина) => {
    expect(к(поля)).toContain(причина)
  })

  it("чужой код можно разрешить настройкой", () => {
    expect(причинаЗапрета(ответПоКоду(КОД_1, { isOwner: false }) as any, false)).toBeNull()
  })
})

describe("проверка кодов", () => {
  it("коды уходят целиком, с разделителем GS, номером ФН и токеном", async () => {
    const { вызовы } = подменитьСеть(честныйЗнак(всёХорошо))

    const итог = await проверитьКоды([КОД_1, КОД_2])

    expect(итог.вид).toBe("можно")
    const запрос = вызовы.find((в) => в.адрес.endsWith("/codes/check"))!
    expect(запрос.тело).toEqual({ codes: [КОД_1, КОД_2], fiscalDriveNumber: "7380440903872060" })
    expect(запрос.заголовки["X-API-KEY"]).toBe("test-token")
    expect(запрос.заголовки["Content-Type"]).toBe("application/json; charset=utf-8")
    if (итог.вид === "можно") {
      expect(итог.коды.map((к) => к.reqId)).toEqual([
        "2ce10bdb-6510-4d37-be04-dd473b98c728",
        "2ce10bdb-6510-4d37-be04-dd473b98c728",
      ])
      // в журнал и в заказ — без криптохвоста
      expect(итог.коды[0].видимый).not.toContain("\u001d")
    }
  })

  it("один плохой код — весь чек нельзя, причина при коде", async () => {
    подменитьСеть(
      честныйЗнак((_, тело) => ({
        body: {
          code: 0,
          codes: [ответПоКоду(тело.codes[0]), ответПоКоду(тело.codes[1], { sold: true })],
          reqId: "r",
          reqTimestamp: 1,
        },
      }))
    )

    const итог = await проверитьКоды([КОД_1, КОД_2])

    expect(итог.вид).toBe("нельзя")
    if (итог.вид === "нельзя") {
      expect(итог.коды[0].запрет).toBeNull()
      expect(итог.коды[1].запрет).toContain("выведен из оборота")
    }
  })

  it("площадка отвечает 500 — повтор, потом переходим на следующую", async () => {
    const { вызовы } = подменитьСеть(
      честныйЗнак((площадка, тело) =>
        площадка === ПЛОЩАДКИ[0] ? { status: 500, body: { code: 500 } } : всёХорошо(площадка, тело)
      )
    )

    const итог = await проверитьКоды([КОД_1])

    expect(итог.вид).toBe("можно")
    const проверки = вызовы.filter((в) => в.адрес.endsWith("/codes/check")).map((в) => в.адрес)
    expect(проверки).toEqual([
      `${ПЛОЩАДКИ[0]}/api/v4/true-api/codes/check`,
      `${ПЛОЩАДКИ[0]}/api/v4/true-api/codes/check`,
      `${ПЛОЩАДКИ[1]}/api/v4/true-api/codes/check`,
    ])
  })

  it("сломанная площадка 15 минут обходится стороной", async () => {
    const { вызовы } = подменитьСеть(
      честныйЗнак((площадка, тело) =>
        площадка === ПЛОЩАДКИ[0] ? new Error("ECONNRESET") : всёХорошо(площадка, тело)
      )
    )

    await проверитьКоды([КОД_1])
    вызовы.length = 0
    await проверитьКоды([КОД_1])

    expect(вызовы.map((в) => в.адрес)).toEqual([`${ПЛОЩАДКИ[1]}/api/v4/true-api/codes/check`])
  })

  it("список площадок не запрашиваем на каждый чек", async () => {
    const { вызовы } = подменитьСеть(честныйЗнак(всёХорошо))

    await проверитьКоды([КОД_1])
    await проверитьКоды([КОД_2])

    expect(вызовы.filter((в) => в.адрес.endsWith("/cdn/info"))).toHaveLength(1)
  })

  it("все площадки молчат — «недоступен», в следующий раз спросим список заново", async () => {
    const { вызовы } = подменитьСеть(честныйЗнак(() => new Error("timeout")))

    const итог = await проверитьКоды([КОД_1])

    expect(итог).toEqual({ вид: "недоступен", причина: expect.stringContaining("timeout") })
    вызовы.length = 0
    await проверитьКоды([КОД_1])
    expect(вызовы.some((в) => в.адрес.endsWith("/cdn/info"))).toBe(true)
  })

  it("400 — ошибка в запросе, другие площадки не мучаем", async () => {
    const { вызовы } = подменитьСеть(честныйЗнак(() => ({ status: 400, body: { code: 400, description: "bad" } })))

    const итог = await проверитьКоды([КОД_1])

    expect(итог.вид).toBe("недоступен")
    expect(вызовы.filter((в) => в.адрес.endsWith("/codes/check"))).toHaveLength(1)
  })

  it("5000 — страна-эмитент молчит: повтор, площадку в сторону не убираем", async () => {
    let раз = 0
    const { вызовы } = подменитьСеть(
      честныйЗнак((площадка, тело) =>
        ++раз <= 2
          ? { status: 500, body: { code: 5000, description: "Transgran BY internal error", codes: [] } }
          : всёХорошо(площадка, тело)
      )
    )

    expect((await проверитьКоды([КОД_1])).вид).toBe("недоступен")
    вызовы.length = 0
    expect((await проверитьКоды([КОД_1])).вид).toBe("можно")
    expect(вызовы.map((в) => в.адрес)).toEqual([`${ПЛОЩАДКИ[0]}/api/v4/true-api/codes/check`])
  })

  it("203 — аварийный режим ЧЗ", async () => {
    подменитьСеть(честныйЗнак(() => ({ status: 203, body: {} })))
    expect(await проверитьКоды([КОД_1])).toEqual({ вид: "авария" })
  })

  it("203 уже на списке площадок — тоже авария", async () => {
    подменитьСеть(() => ({ status: 203, body: {} }))
    expect(await проверитьКоды([КОД_1])).toEqual({ вид: "авария" })
  })

  it("401 — токен не принят, отмечаем особо", async () => {
    подменитьСеть(() => ({ status: 401, body: {} }))
    expect(await проверитьКоды([КОД_1])).toEqual({
      вид: "недоступен",
      причина: expect.stringContaining("токен"),
      токен: true,
    })
  })

  it("без токена в сеть не ходим", async () => {
    delete process.env.CHZ_TOKEN
    const { вызовы } = подменитьСеть(() => new Error("не должно быть"))

    expect(await проверитьКоды([КОД_1])).toMatchObject({ вид: "недоступен", токен: true })
    expect(вызовы).toHaveLength(0)
  })

  it("ЧЗ не прислал ответ по коду — не считаем это разрешением", async () => {
    подменитьСеть(честныйЗнак(() => ({ body: { code: 0, codes: [], reqId: "r", reqTimestamp: 1 } })))
    expect((await проверитьКоды([КОД_1])).вид).toBe("недоступен")
  })

  it("пустой список — проверять нечего", async () => {
    const { вызовы } = подменитьСеть(() => new Error("не должно быть"))
    expect(await проверитьКоды([])).toEqual({ вид: "можно", коды: [] })
    expect(вызовы).toHaveLength(0)
  })
})
