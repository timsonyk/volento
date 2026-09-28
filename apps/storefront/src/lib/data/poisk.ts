"use server"

import { HttpTypes } from "@medusajs/types"

import { listModelColors, listProductsWithSort } from "./products"

/**
 * Поиск по каталогу для всплывающей шторки.
 *
 * Отдаёт немного и сразу: шторка показывает первые находки, пока человек
 * печатает, а за полным списком он уходит на страницу поиска по Enter.
 */
const СКОЛЬКО = 8

export type НайденныйТовар = {
  товар: HttpTypes.StoreProduct
  цвета: unknown
}

export type Находки = {
  запрос: string
  товары: HttpTypes.StoreProduct[]
  цветаПоМодели: Record<string, any>
  всего: number
}

export async function искатьТовары(
  запрос: string,
  countryCode: string
): Promise<Находки> {
  const чистый = запрос.trim()
  const пусто: Находки = { запрос: чистый, товары: [], цветаПоМодели: {}, всего: 0 }

  // Одна буква ничего не говорит: по ней найдётся половина каталога, а
  // запрос уйдёт на сервер с каждым нажатием.
  if (чистый.length < 2) {
    return пусто
  }

  try {
    const { response } = await listProductsWithSort({
      page: 1,
      countryCode,
      queryParams: { limit: СКОЛЬКО, q: чистый } as any,
    })

    const товары = response?.products ?? []
    const цветаПоМодели = товары.length
      ? await listModelColors({ products: товары, countryCode })
      : {}

    return {
      запрос: чистый,
      товары,
      цветаПоМодели,
      всего: response?.count ?? товары.length,
    }
  } catch (ошибка) {
    console.error("Поиск не отработал:", (ошибка as Error)?.message)
    return пусто
  }
}
