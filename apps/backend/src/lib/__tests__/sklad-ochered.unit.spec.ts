import { несобранныеЗаказы } from "../sklad-ochered"

/** Поддельный query.graph над списком заказов: страницы и отбор по id. */
const подделка = (заказы: any[]) => {
  const запросы: any[] = []
  const query = {
    graph: async (з: any) => {
      запросы.push(з)
      if (з.filters.id) {
        return { data: заказы.filter((о) => з.filters.id.includes(о.id)) }
      }
      const { skip = 0, take } = з.pagination
      return { data: заказы.slice(skip, skip + take) }
    },
  }
  return { query, запросы }
}

const отправленный = (и: number) => ({ id: `o${и}`, fulfillments: [{ id: `f${и}`, canceled_at: null }] })
const новый = (и: number) => ({ id: `o${и}`, fulfillments: [] })

describe("очередь склада: несобранные заказы", () => {
  it("новый заказ виден и после тысячи старых отправленных", async () => {
    const заказы = [...Array.from({ length: 1200 }, (_, и) => отправленный(и)), новый(1200)]
    const { query } = подделка(заказы)

    const итог = await несобранныеЗаказы(query, ["id"])

    expect(итог.map((з) => з.id)).toEqual(["o1200"])
  })

  it("заказ с отменённой сборкой снова ждёт склада", async () => {
    const { query } = подделка([
      { id: "a", fulfillments: [{ id: "f", canceled_at: "2026-10-21" }] },
      отправленный(1),
    ])

    expect((await несобранныеЗаказы(query, ["id"])).map((з) => з.id)).toEqual(["a"])
  })

  it("несобранных нет — второго запроса нет", async () => {
    const { query, запросы } = подделка([отправленный(1)])

    expect(await несобранныеЗаказы(query, ["id"])).toEqual([])
    expect(запросы).toHaveLength(1)
  })
})
