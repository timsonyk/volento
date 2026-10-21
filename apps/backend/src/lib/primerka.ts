/**
 * Примерка и частичный выкуп в пунктах выдачи — то, что не зависит от
 * Medusa: какие услуги заказать у службы, как разложить посылку по парам
 * и как прочитать итог выдачи. Исследование —
 * docs/примерка-и-частичный-выкуп.md.
 *
 * Каждая пара уходит в службу отдельной строкой со своим кодом «Честного
 * знака». Тогда служба отвечает по каждой паре, взяли её или нет, и мы
 * знаем, какие коды проданы: их — в чек «полный расчёт», остальные пары
 * едут обратно на склад непроданными.
 */

// metadata заказа: итог выдачи по каждой сборке, { [id сборки]: ИтогСборки }
export const ИТОГ = "dostavka_itog"

export type ДопУслуга = { key: string; value: string }

/**
 * Частичный выкуп. У Яндекса он же включает примерку и работает только в
 * пункте с примерочной — в пункт без неё заказ с этой услугой служба не
 * примет, поэтому без примерочной не просим. У СДЭК частичная доставка
 * от примерочной не зависит: смотреть вещи покупатель может в любом
 * пункте.
 */
export function допУслуги(служба: string | null | undefined, пункт: any): ДопУслуга[] {
  if (служба === "yataxi") {
    return Number(пункт?.fittingRoom) === 1
      ? [{ key: "yataxi.particular_items_refuse", value: "1" }]
      : []
  }
  if (служба === "cdek") {
    return [{ key: "cdek.PartialDelivery", value: "1" }]
  }
  return []
}

/**
 * Коды пар по артикулу — так строки посылки названы в запросе к ApiShip.
 * Берём только строки этой сборки.
 */
export function кодыПоАртикулу(
  строки: { id: string; variant_sku?: string | null; variant?: { sku?: string | null } | null }[],
  коды: Record<string, string[]>,
  вСборке?: Set<string>
): Map<string, string[]> {
  const итог = new Map<string, string[]>()
  for (const с of строки) {
    const артикул = с.variant?.sku ?? с.variant_sku
    if (!артикул || (вСборке && !вСборке.has(с.id))) {
      continue
    }
    итог.set(артикул, [...(итог.get(артикул) ?? []), ...(коды[с.id] ?? [])])
  }
  return итог
}

/**
 * Строка посылки «брюки × 3» становится тремя строками по одной паре, у
 * каждой свой код. ApiShip сам требует: с кодом маркировки количество не
 * больше одного. Кодов не хватило — пара уходит без кода, но отдельной
 * строкой: выкуп всё равно придёт по каждой.
 */
export function поПарам(товары: any[], коды: Map<string, string[]>): any[] {
  const осталось = new Map([...коды].map(([а, к]) => [а, [...к]]))

  return товары.flatMap((т) => {
    const штук = Math.max(1, Number(т.quantity) || 1)
    return Array.from({ length: штук }, () => {
      const код = т.articul ? осталось.get(т.articul)?.shift() : undefined
      return { ...т, quantity: 1, ...(код ? { markCode: код } : {}) }
    })
  })
}

// ---------- итог выдачи ----------

/** Статусы ApiShip, после которых судьба посылки ясна. */
export const ВЫДАН = "delivered"
export const ЧАСТИЧНО = "partialReturn"
export const ОТКАЗ = new Set(["returnReady", "returning", "returned", "returnedFromDelivery"])
export const БЕДА = new Set(["lost", "problem"])

export const итоговый = (статус: string) =>
  статус === ВЫДАН || статус === ЧАСТИЧНО || ОТКАЗ.has(статус)

export type СтрокаИтога = { id: string; kody: string[]; shtuk: number }

export type Итог = {
  vykupleno: СтрокаИтога[]
  nevykupleno: СтрокаИтога[]
  // одинаковые пары без кода в ответе службы: какая именно вернулась,
  // узнаем только на складе
  netochno: boolean
}

/**
 * Что покупатель забрал, а что едет обратно.
 *
 * строки — строки этой сборки: id, артикул, коды и сколько штук.
 * товары — товары из ответа ApiShip (items или places[].items) с
 * quantityDelivered; нужны только для частичной выдачи.
 *
 * null — служба сказала «частично», но не сказала что: решать человеку.
 */
export function итогВыдачи(
  статус: string,
  строки: { id: string; artikul: string | null; kody: string[]; shtuk: number }[],
  товары: any[] = []
): Итог | null {
  const всё = (с: (typeof строки)[number]): СтрокаИтога => ({ id: с.id, kody: [...с.kody], shtuk: с.shtuk })

  if (статус === ВЫДАН) {
    return { vykupleno: строки.map(всё), nevykupleno: [], netochno: false }
  }
  if (ОТКАЗ.has(статус)) {
    return { vykupleno: [], nevykupleno: строки.map(всё), netochno: false }
  }
  if (статус !== ЧАСТИЧНО) {
    return null
  }

  const сОтветом = товары.filter((т) => т.quantityDelivered !== null && т.quantityDelivered !== undefined)
  if (!сОтветом.length) {
    return null
  }

  // выкупленные коды — точно, если служба ответила по коду
  const выкупленныеКоды = new Set<string>()
  const невыкупленныеКоды = new Set<string>()
  // без кода — только сколько штук артикула взяли
  const взялиПоАртикулу = new Map<string, number>()

  for (const т of сОтветом) {
    const взяли = Math.max(0, Number(т.quantityDelivered))
    const штук = Math.max(1, Number(т.quantity) || 1)
    if (т.markCode) {
      ;(взяли >= штук ? выкупленныеКоды : невыкупленныеКоды).add(т.markCode)
    } else if (т.articul) {
      взялиПоАртикулу.set(т.articul, (взялиПоАртикулу.get(т.articul) ?? 0) + Math.min(взяли, штук))
    }
  }

  let netochno = false
  const выкуплено: СтрокаИтога[] = []
  const невыкуплено: СтрокаИтога[] = []

  for (const с of строки) {
    const взяты: string[] = []
    const нет: string[] = []
    const неясные: string[] = []

    for (const код of с.kody) {
      if (выкупленныеКоды.has(код)) взяты.push(код)
      else if (невыкупленныеКоды.has(код)) нет.push(код)
      else неясные.push(код)
    }

    // пары без ответа по коду делим по количеству взятых этого артикула
    let ещёВзяли = с.artikul ? взялиПоАртикулу.get(с.artikul) ?? 0 : 0
    const безКода = с.shtuk - с.kody.length
    for (const код of неясные) {
      if (ещёВзяли > 0) {
        взяты.push(код)
        ещёВзяли--
      } else {
        нет.push(код)
      }
    }
    const взятыБезКода = Math.min(безКода, ещёВзяли)
    if (с.artikul && взялиПоАртикулу.has(с.artikul)) {
      взялиПоАртикулу.set(с.artikul, ещёВзяли - взятыБезКода)
    }

    // одинаковые пары, из которых взяли не все, а служба не сказала,
    // какие именно, — коды поделили наугад
    if (неясные.length > 1 && взяты.length && нет.length) {
      netochno = true
    }

    const штукВзяли = взяты.length + взятыБезКода
    if (штукВзяли) выкуплено.push({ id: с.id, kody: взяты, shtuk: штукВзяли })
    if (с.shtuk - штукВзяли) невыкуплено.push({ id: с.id, kody: нет, shtuk: с.shtuk - штукВзяли })
  }

  return { vykupleno: выкуплено, nevykupleno: невыкуплено, netochno }
}

/** Товары из ответа ApiShip о заказе: по местам, а если мест нет — верхние. */
export function товарыОтвета(ответ: any): any[] {
  const поМестам = (ответ?.places ?? []).flatMap((м: any) => м?.items ?? [])
  return поМестам.length ? поМестам : ответ?.items ?? []
}
