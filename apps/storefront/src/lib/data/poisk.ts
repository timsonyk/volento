"use server"

import { HttpTypes } from "@medusajs/types"

import { listModelColors, listProductsWithSort } from "./products"

/**
 * Поиск по каталогу для всплывающей шторки.
 *
 * Отдаёт немного и сразу: шторка показывает первые находки, пока человек
 * печатает, а за полным списком он уходит на страницу поиска по Enter.
 */
const СКОЛЬКО = 4

// Цвет у нас — отдельный товар, поэтому «палаццо» возвращает одни и те же
// брюки восемь раз подряд. В шторке мест мало: берём с запасом и
// оставляем по одному товару на модель, остальные цвета и так видны
// кружками на карточке.
const ЗАПАС = 16

function поОднойМодели(
  товары: HttpTypes.StoreProduct[]
): HttpTypes.StoreProduct[] {
  const видели = new Set<string>()
  const отобранные: HttpTypes.StoreProduct[] = []

  for (const т of товары) {
    const модель = т.metadata?.model as string | undefined
    // Товар без модели — сам себе модель, его не с чем схлопывать.
    const ключ = модель || т.id
    if (видели.has(ключ)) {
      continue
    }
    видели.add(ключ)
    отобранные.push(т)
  }

  return отобранные
}

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
      queryParams: {
        limit: ЗАПАС,
        q: чистый,
        // Без картинок вариантов: в шторке видна только обложка и вторая
        // фотография товара, а вариантов у брюк по три десятка — с ними
        // ответ весит мегабайты и человек ждёт находки дольше, чем печатал.
        fields:
          "*variants.calculated_price,+variants.inventory_quantity,*variants.options,+metadata,+tags,",
      } as any,
    })

    const товары = поОднойМодели(response?.products ?? []).slice(0, СКОЛЬКО)
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
