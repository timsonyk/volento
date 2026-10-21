import { допУслуги, итогВыдачи, кодыПоАртикулу, поПарам, товарыОтвета } from "../primerka"

const к = (n: number) => `0104601234567890215пара${n}\u001d93tail`

describe("примерка: что заказать у службы", () => {
  it("Яндекс — частичный выкуп только в пункте с примерочной", () => {
    expect(допУслуги("yataxi", { fittingRoom: 1 })).toEqual([{ key: "yataxi.particular_items_refuse", value: "1" }])
    expect(допУслуги("yataxi", { fittingRoom: 0 })).toEqual([])
    expect(допУслуги("yataxi", {})).toEqual([])
  })

  it("СДЭК — частичная доставка везде, прочие службы — ничего", () => {
    expect(допУслуги("cdek", {})).toEqual([{ key: "cdek.PartialDelivery", value: "1" }])
    expect(допУслуги("dpd", { fittingRoom: 1 })).toEqual([])
  })
})

describe("примерка: посылка по парам", () => {
  it("строка × 3 становится тремя парами со своими кодами", () => {
    const коды = кодыПоАртикулу(
      [{ id: "a", variant: { sku: "5986-46/170" } }, { id: "b", variant_sku: "5110-38" }],
      { a: [к(1), к(2), к(3)], b: [к(4)] }
    )
    const пары = поПарам(
      [
        { articul: "5986-46/170", quantity: 3, assessedCost: 8499, weight: 450 },
        { articul: "5110-38", quantity: 1, assessedCost: 7799, weight: 400 },
      ],
      коды
    )
    expect(пары).toHaveLength(4)
    expect(пары.map((п) => п.quantity)).toEqual([1, 1, 1, 1])
    expect(пары.map((п) => п.markCode)).toEqual([к(1), к(2), к(3), к(4)])
    expect(пары[0].assessedCost).toBe(8499)
  })

  it("кодов не хватило — пара всё равно отдельной строкой, без кода", () => {
    const пары = поПарам([{ articul: "x", quantity: 2 }], new Map([["x", [к(1)]]]))
    expect(пары).toEqual([
      { articul: "x", quantity: 1, markCode: к(1) },
      { articul: "x", quantity: 1 },
    ])
  })

  it("строки чужой сборки не берём", () => {
    const коды = кодыПоАртикулу([{ id: "a", variant_sku: "x" }, { id: "b", variant_sku: "y" }], { a: [к(1)], b: [к(2)] }, new Set(["b"]))
    expect([...коды]).toEqual([["y", [к(2)]]])
  })
})

describe("примерка: итог выдачи", () => {
  const строки = [
    { id: "a", artikul: "5986-46/170", kody: [к(1), к(2)], shtuk: 2 },
    { id: "b", artikul: "5110-38", kody: [к(3)], shtuk: 1 },
  ]

  it("выдан — выкуплено всё", () => {
    const и = итогВыдачи("delivered", строки)!
    expect(и.vykupleno.map((с) => с.kody)).toEqual([[к(1), к(2)], [к(3)]])
    expect(и.nevykupleno).toEqual([])
  })

  it("возврат — не выкуплено ничего", () => {
    for (const статус of ["returnReady", "returning", "returned", "returnedFromDelivery"]) {
      const и = итогВыдачи(статус, строки)!
      expect(и.vykupleno).toEqual([])
      expect(и.nevykupleno.map((с) => с.shtuk)).toEqual([2, 1])
    }
  })

  it("частично, служба ответила по кодам — точно знаем, какая пара вернулась", () => {
    const и = итогВыдачи("partialReturn", строки, [
      { articul: "5986-46/170", markCode: к(1), quantity: 1, quantityDelivered: 0 },
      { articul: "5986-46/170", markCode: к(2), quantity: 1, quantityDelivered: 1 },
      { articul: "5110-38", markCode: к(3), quantity: 1, quantityDelivered: 1 },
    ])!
    expect(и.vykupleno).toEqual([
      { id: "a", kody: [к(2)], shtuk: 1 },
      { id: "b", kody: [к(3)], shtuk: 1 },
    ])
    expect(и.nevykupleno).toEqual([{ id: "a", kody: [к(1)], shtuk: 1 }])
    expect(и.netochno).toBe(false)
  })

  it("частично, разные артикулы без кодов в ответе — тоже точно", () => {
    const и = итогВыдачи("partialReturn", строки, [
      { articul: "5986-46/170", quantity: 2, quantityDelivered: 2 },
      { articul: "5110-38", quantity: 1, quantityDelivered: 0 },
    ])!
    expect(и.vykupleno).toEqual([{ id: "a", kody: [к(1), к(2)], shtuk: 2 }])
    expect(и.nevykupleno).toEqual([{ id: "b", kody: [к(3)], shtuk: 1 }])
    expect(и.netochno).toBe(false)
  })

  it("две одинаковые пары, взяли одну, кодов в ответе нет — делим наугад и помечаем", () => {
    const и = итогВыдачи("partialReturn", строки, [
      { articul: "5986-46/170", quantity: 2, quantityDelivered: 1 },
      { articul: "5110-38", quantity: 1, quantityDelivered: 1 },
    ])!
    expect(и.vykupleno[0]).toEqual({ id: "a", kody: [к(1)], shtuk: 1 })
    expect(и.nevykupleno).toEqual([{ id: "a", kody: [к(2)], shtuk: 1 }])
    expect(и.netochno).toBe(true)
  })

  it("частично без количеств — решать человеку", () => {
    expect(итогВыдачи("partialReturn", строки, [{ articul: "5110-38", quantity: 1 }])).toBeNull()
    expect(итогВыдачи("onWay", строки)).toBeNull()
  })

  it("товары берём по местам, а если мест нет — верхние", () => {
    expect(товарыОтвета({ items: [{ a: 1 }], places: [{ items: [{ b: 1 }] }] })).toEqual([{ b: 1 }])
    expect(товарыОтвета({ items: [{ a: 1 }], places: [] })).toEqual([{ a: 1 }])
  })
})
