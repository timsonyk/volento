import {
  ЖИВЁТ_МС,
  письмоПоступления,
  разделить,
  разобратьОжидания,
  текстПоступления,
  темаПоступления,
} from "../postuplenie"

const СЕЙЧАС = Date.parse("2026-11-22T10:00:00Z")
const вчера = new Date(СЕЙЧАС - 24 * 3600 * 1000).toISOString()

describe("сообщить, когда появится", () => {
  it("из метаданных берёт только похожее на просьбы", () => {
    expect(разобратьОжидания(null)).toEqual([])
    expect(разобратьОжидания({ zhdu: "мусор" })).toEqual([])
    expect(
      разобратьОжидания({
        zhdu: [{ v: "variant_01ABC", t: вчера }, { v: "'; drop table", t: вчера }, null, { t: вчера }],
      })
    ).toEqual([{ v: "variant_01ABC", t: вчера }])
  })

  it("название и адрес товара у просьбы сохраняются", () => {
    expect(
      разобратьОжидания({ zhdu: [{ v: "variant_A", t: вчера, n: "Брюки, 42 / 170", h: "bryuki", x: 1 }] })
    ).toEqual([{ v: "variant_A", t: вчера, n: "Брюки, 42 / 170", h: "bryuki" }])
  })

  it("появившийся размер уходит в письмо, остальные ждут", () => {
    const итог = разделить(
      [
        { v: "variant_A", t: вчера },
        { v: "variant_B", t: вчера },
      ],
      new Set(["variant_A"]),
      СЕЙЧАС
    )
    expect(итог.сообщить.map((о) => о.v)).toEqual(["variant_A"])
    expect(итог.оставить.map((о) => о.v)).toEqual(["variant_B"])
    expect(итог.устарело).toBe(0)
  })

  it("просьба старше полугода снимается без письма", () => {
    const давно = new Date(СЕЙЧАС - ЖИВЁТ_МС - 1000).toISOString()
    const итог = разделить([{ v: "variant_A", t: давно }], new Set(), СЕЙЧАС)
    expect(итог).toEqual({ сообщить: [], оставить: [], устарело: 1 })
  })

  it("старый, но появившийся размер всё равно сообщаем", () => {
    const давно = new Date(СЕЙЧАС - ЖИВЁТ_МС - 1000).toISOString()
    const итог = разделить([{ v: "variant_A", t: давно }], new Set(["variant_A"]), СЕЙЧАС)
    expect(итог.сообщить).toHaveLength(1)
  })

  it("письмо называет вещь, размер и даёт ссылку", () => {
    const размеры = [
      {
        id: "variant_A",
        название: "Брюки <палаццо>",
        вариант: "42 / 170",
        адрес: "https://example.com/ru/products/bryuki?v_id=variant_A",
      },
    ]
    expect(темаПоступления(размеры)).toContain("снова в наличии")
    const текст = текстПоступления("Анна", размеры)
    expect(текст).toContain("Анна, здравствуйте!")
    expect(текст).toContain("42 / 170")
    expect(текст).toContain("https://example.com/ru/products/bryuki?v_id=variant_A")
    const html = письмоПоступления(null, размеры)
    expect(html).toContain("Брюки &lt;палаццо&gt;")
    expect(html).toContain('href="https://example.com/ru/products/bryuki?v_id=variant_A"')
    expect(html).not.toContain("undefined")
  })
})
