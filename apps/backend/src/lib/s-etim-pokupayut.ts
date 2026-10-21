import { этоТест } from "./sklad-test-metka"

/**
 * «С этим покупают»: какие товары чаще всего лежали в одном заказе.
 *
 * Считаем по товарам (модель в цвете), а не по размерам: размер покупатель
 * выберет сам. Отменённые заказы и тестовые заказы склада не учитываем —
 * первые не покупка, вторые нам подсовываем мы сами.
 *
 * Пока заказов мало, ответ почти всегда пустой — витрина тогда блок не
 * показывает. Выдумывать «сопутствующие» без данных не стали.
 */
export type ЗаказДляПодсчёта = {
  status?: string | null
  metadata?: Record<string, unknown> | null
  items?: ({ product_id?: string | null } | null)[] | null
}

export function посчитатьПары(заказы: ЗаказДляПодсчёта[]): Map<string, Map<string, number>> {
  const пары = new Map<string, Map<string, number>>()

  for (const з of заказы) {
    if (з.status === "canceled" || этоТест(з)) {
      continue
    }
    // один товар дважды в заказе (два размера) — это одна покупка
    const товары = [
      ...new Set((з.items ?? []).map((с) => с?.product_id).filter((id): id is string => !!id)),
    ]
    for (const а of товары) {
      for (const б of товары) {
        if (а === б) {
          continue
        }
        const с = пары.get(а) ?? new Map<string, number>()
        с.set(б, (с.get(б) ?? 0) + 1)
        пары.set(а, с)
      }
    }
  }

  return пары
}

/** Соседи товара по заказам, самые частые первыми. */
export function сЭтимПокупают(
  пары: Map<string, Map<string, number>>,
  id: string,
  сколько = 8
): string[] {
  return [...(пары.get(id) ?? new Map<string, number>()).entries()]
    .sort((а, б) => б[1] - а[1] || а[0].localeCompare(б[0]))
    .slice(0, сколько)
    .map(([другой]) => другой)
}
