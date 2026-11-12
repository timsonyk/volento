import { PDFDocument } from "pdf-lib"

import { страницаНаклейки } from "../nakleyka-stranica"
import { поПарам } from "../primerka"
import {
  безПустых,
  пакетыСборки,
  разложитьПоМестам,
  разобратьСборку,
  этоПостамат,
} from "../sklad-pakety"
import { тестоваяНаклейка } from "../sklad-test-metka"
import { размерыМеста } from "../upakovka-tablica"

const К = (n: number) => `010460000000000021SER${n}\u001d93abcd`

const заказ = {
  items: [
    { id: "s1", quantity: 2, variant_sku: "3147-46/176" },
    { id: "s2", quantity: 1, variant_sku: "5110-38" },
  ],
}

describe("разбор сборки по пакетам", () => {
  it("старый вид — pozicii — один пакет", () => {
    const р: any = разобратьСборку(
      {
        pozicii: [
          { artikul: "3147-46/176", kolichestvo: 2, kody: [К(1), К(2)] },
          { id_stroki: "s2", kolichestvo: 1, kody: [К(3)] },
        ],
      },
      заказ
    )
    expect(р.пакеты).toHaveLength(1)
    expect(р.пакеты[0]).toMatchObject({ nomer: 1, sklad: null })
    expect(р.строки).toEqual([
      { id: "s1", quantity: 2, kody: [К(1), К(2)] },
      { id: "s2", quantity: 1, kody: [К(3)] },
    ])
  })

  it("два пакета, одна строка разошлась по обоим", () => {
    const р: any = разобратьСборку(
      {
        pakety: [
          { sklad: "A", pozicii: [{ artikul: "3147-46/176", kolichestvo: 1, kody: [К(1)] }] },
          {
            sklad: "B",
            pozicii: [
              { artikul: "3147-46/176", kolichestvo: 1, kody: [К(2)] },
              { artikul: "5110-38", kolichestvo: 1, kody: [К(3)] },
            ],
          },
        ],
      },
      заказ
    )
    expect(р.пакеты.map((п: any) => [п.nomer, п.sklad])).toEqual([[1, "A"], [2, "B"]])
    expect(р.строки).toEqual([
      { id: "s1", quantity: 2, kody: [К(1), К(2)] },
      { id: "s2", quantity: 1, kody: [К(3)] },
    ])
    // разбор не портит сами пакеты, складывая строки
    expect(р.пакеты[0].stroki[0].kody).toEqual([К(1)])
  })

  it("ошибки говорят, что исправить", () => {
    const о = (тело: any) => (разобратьСборку(тело, заказ) as any).ошибка
    expect(о({})).toMatch(/Пришлите pozicii/)
    expect(о({ pakety: [] })).toMatch(/пусто/)
    expect(о({ pakety: [{ sklad: "A" }] })).toMatch(/Пакет 1/)
    expect(о({ pakety: [{ pozicii: [] }], pozicii: [] })).toMatch(/не оба/)
    expect(о({ pozicii: [{ artikul: "нет", kolichestvo: 1 }] })).toMatch(/нет в этом заказе/)
    expect(о({ pozicii: [{ artikul: "5110-38", kolichestvo: 2 }] })).toMatch(/от 0 до 1/)
    expect(
      о({
        pakety: [
          { pozicii: [{ artikul: "5110-38", kolichestvo: 1 }] },
          { pozicii: [{ artikul: "5110-38", kolichestvo: 1 }] },
        ],
      })
    ).toMatch(/разложено 2 шт., а в заказе 1/)
    expect(
      о({
        pakety: [
          { pozicii: [{ artikul: "5110-38", kolichestvo: 1 }] },
          { pozicii: [{ artikul: "3147-46/176", kolichestvo: 0 }] },
        ],
      })
    ).toMatch(/Пакет 2 пустой/)
    expect(о({ pakety: Array.from({ length: 6 }, () => ({ pozicii: [{ artikul: "5110-38", kolichestvo: 1 }] })) })).toMatch(/не больше 5/)
  })

  it("пустые строки не попадают в пакет", () => {
    const р: any = разобратьСборку(
      { pozicii: [{ artikul: "3147-46/176", kolichestvo: 2 }, { artikul: "5110-38", kolichestvo: 0 }] },
      заказ
    )
    expect(безПустых(р.пакеты)[0].stroki).toHaveLength(1)
  })
})

describe("пакеты и сборка", () => {
  const пакеты = [
    { nomer: 1, sklad: "A", stroki: [{ id: "s1", quantity: 1, kody: [К(1)] }] },
    { nomer: 2, sklad: "B", stroki: [{ id: "s1", quantity: 1, kody: [К(2)] }, { id: "s2", quantity: 1, kody: [К(3)] }] },
  ]

  it("годятся, только если состав сходится со сборкой", () => {
    expect(пакетыСборки(пакеты, new Map([["s1", 2], ["s2", 1]]))).toHaveLength(2)
    expect(пакетыСборки(пакеты, new Map([["s1", 2]]))).toEqual([])
    expect(пакетыСборки(пакеты, new Map([["s1", 1], ["s2", 1]]))).toEqual([])
    expect(пакетыСборки([пакеты[0]], new Map([["s1", 1]]))).toEqual([])
    expect(пакетыСборки(undefined, new Map())).toEqual([])
  })

  it("пары расходятся по местам по своим кодам, номера сквозные", () => {
    const товары = [
      { articul: "3147-46/176", description: "Брюки", quantity: 2, weight: 450, height: 4, length: 30, width: 40 },
      { articul: "5110-38", description: "Юбка", quantity: 1, weight: 400, height: 3, length: 30, width: 33 },
    ]
    const коды = new Map([["3147-46/176", [К(1), К(2)]], ["5110-38", [К(3)]]])
    const артикулы = new Map([["s1", "3147-46/176"], ["s2", "5110-38"]])

    const места = разложитьПоМестам({ height: 11, length: 30, width: 40, weight: 1300 }, поПарам(товары, коды), пакеты, артикулы)

    expect(места).toHaveLength(2)
    expect(места[0].items.map((т: any) => [т.articul, т.markCode])).toEqual([["3147-46/176#1", К(1)]])
    expect(места[1].items.map((т: any) => [т.articul, т.markCode])).toEqual([
      ["3147-46/176#2", К(2)],
      ["5110-38", К(3)],
    ])
    expect(места.map((м: any) => м.placeNumber)).toEqual(["1", "2"])
    expect(места[0]).toMatchObject({ weight: 450, height: 4, length: 30, width: 40 })
    expect(места[1]).toMatchObject({ weight: 850, height: 7, length: 30, width: 40 })
  })

  it("пара без кода идёт туда, где её артикула не хватает", () => {
    const товары = [{ articul: "3147-46/176", quantity: 2, weight: 450 }]
    const безКодов = [
      { nomer: 1, sklad: null, stroki: [{ id: "s1", quantity: 1, kody: [] }] },
      { nomer: 2, sklad: null, stroki: [{ id: "s1", quantity: 1, kody: [] }] },
    ]
    const места = разложитьПоМестам({}, поПарам(товары, new Map()), безКодов, new Map([["s1", "3147-46/176"]]))
    expect(места.map((м: any) => м.items.length)).toEqual([1, 1])
  })

  it("постамат узнаём по типу и по названию", () => {
    expect(этоПостамат({ type: 2 })).toBe(true)
    expect(этоПостамат({ type: "1", name: "Постамат Халва" })).toBe(true)
    expect(этоПостамат({ type: 1, name: "СДЭК на Ленина" })).toBe(false)
    expect(этоПостамат({ type: 1 }, { tariffName: "Посылка склад-постамат" })).toBe(true)
    expect(этоПостамат({ type: 1 }, { tariffName: "Посылка склад-склад" })).toBe(false)
    expect(этоПостамат(null)).toBe(false)
  })
})

describe("таблица упаковки", () => {
  const пары = [
    { quantity: 1, weight: 450, height: 4, length: 30, width: 40 },
    { quantity: 2, weight: 400, height: 3, length: 30, width: 33 },
  ]

  it("без строк — стопкой, как считал плагин", () => {
    expect(размерыМеста(пары)).toEqual({ length: 30, width: 40, height: 10, weight: 1250 })
  })

  it("у товара пусто — берём пару из таблицы", () => {
    expect(размерыМеста([{ quantity: 2 }])).toEqual({ length: 30, width: 40, height: 8, weight: 900 })
  })

  it("со строками — размеры пакета и вес тары", () => {
    const таблица = {
      para: { dlina: 40, shirina: 30, tolshina: 4, ves: 450 },
      pakety: [
        { do_par: 4, dlina: 50, shirina: 40, vysota: 12, ves_tary: 40 },
        { do_par: 2, dlina: 45, shirina: 35, vysota: 6, ves_tary: 30 },
      ],
      maksimum_paketov: 5,
    }
    expect(размерыМеста(пары, таблица)).toEqual({ length: 40, width: 50, height: 12, weight: 1290 })
    expect(размерыМеста([пары[0]], таблица)).toEqual({ length: 35, width: 45, height: 6, weight: 480 })
    // больше, чем в последней строке, — снова стопкой
    expect(размерыМеста([{ ...пары[0], quantity: 5 }], таблица).height).toBe(20)
  })
})

describe("наклейка по местам", () => {
  const файл = (мест: number) =>
    Buffer.from(тестоваяНаклейка("77", мест).split(",")[1], "base64")

  it("тестовая наклейка — по странице на место", async () => {
    expect((await PDFDocument.load(файл(1))).getPageCount()).toBe(1)
    expect((await PDFDocument.load(файл(3))).getPageCount()).toBe(3)
  })

  it("достаём страницу своего места", async () => {
    const вторая = await страницаНаклейки(файл(2), 2, 2)
    expect(вторая).not.toBeNull()
    expect((await PDFDocument.load(вторая!)).getPageCount()).toBe(1)
  })

  it("страниц не столько, сколько мест, — не угадываем", async () => {
    expect(await страницаНаклейки(файл(1), 2, 2)).toBeNull()
    expect(await страницаНаклейки(файл(3), 1, 2)).toBeNull()
  })
})
