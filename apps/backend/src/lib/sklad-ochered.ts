/**
 * Оплаченные заказы, которые склад ещё не собрал.
 *
 * «Собран» у Medusa — не поле заказа, а вывод из его сборок, поэтому
 * фильтром в запрос его не передать. А статус pending остаётся у заказа
 * и после отправки: завершёнными мы заказы не помечаем. Раньше брали
 * первые 200–300 таких заказов и отбирали уже среди них — после
 * трёхсотого заказа старые отправленные заняли бы все места, и новые не
 * дошли бы ни до склада, ни до сторожа «склад молчит».
 *
 * Поэтому перебираем все страницами, но только с лёгкими полями, а
 * полные данные берём у отобранных.
 */
const СТРАНИЦА = 500

type Query = {
  graph: (запрос: any) => Promise<{ data: any[] }>
}

export async function несобранныеЗаказы(query: Query, поля: string[]): Promise<any[]> {
  const иды: string[] = []

  for (let skip = 0; ; skip += СТРАНИЦА) {
    const { data } = await query.graph({
      entity: "order",
      filters: { status: "pending" },
      fields: ["id", "fulfillments.id", "fulfillments.canceled_at"],
      pagination: { order: { created_at: "ASC" }, skip, take: СТРАНИЦА },
    })

    for (const з of data ?? []) {
      // Отменённая сборка не в счёт: после неё заказ снова ждёт склада
      if (!(з.fulfillments ?? []).some((с: any) => с && !с.canceled_at)) {
        иды.push(з.id)
      }
    }

    if ((data ?? []).length < СТРАНИЦА) {
      break
    }
  }

  if (!иды.length) {
    return []
  }

  const { data } = await query.graph({
    entity: "order",
    filters: { id: иды },
    fields: поля,
    pagination: { order: { created_at: "ASC" }, take: иды.length },
  })

  return data ?? []
}
