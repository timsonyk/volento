/**
 * Короткая сводка нового заказа для владельца: в колокольчик админки и
 * письмом. Отдельно от письма покупателю — там вёрстка и вежливость, здесь
 * только то, что нужно, чтобы понять заказ с одного взгляда.
 */
type Позиция = { title?: string | null; variant_title?: string | null; quantity?: number | null }

export type ЗаказВладельцу = {
  display_id?: number | null
  email?: string | null
  total?: number | null
  currency_code?: string | null
  items?: (Позиция | null)[] | null
}

export function сводкаВладельцу(
  заказ: ЗаказВладельцу,
  доставка: { способ: string | null; адрес: string | null }
): { тема: string; текст: string } {
  const сумма = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: (заказ.currency_code ?? "rub").toUpperCase(),
    maximumFractionDigits: 0,
  }).format(Number(заказ.total ?? 0))

  const строки = (заказ.items ?? [])
    .filter((п): п is Позиция => !!п)
    .map((п) => `${п.title ?? "?"}${п.variant_title ? `, ${п.variant_title}` : ""} — ${п.quantity ?? 0} шт.`)

  return {
    тема: `Новый заказ № ${заказ.display_id ?? "?"} на ${сумма}`,
    текст: [
      ...строки,
      "",
      ...(доставка.способ ? [`Доставка: ${доставка.способ}`] : []),
      ...(доставка.адрес ? [`Куда: ${доставка.адрес}`] : []),
      ...(заказ.email ? [`Покупатель: ${заказ.email}`] : []),
    ].join("\n"),
  }
}
