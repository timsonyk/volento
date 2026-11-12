import { HttpTypes } from "@medusajs/types"

/**
 * Товар, урезанный до того, что нужно карточке в списке.
 *
 * Список каталога живёт в браузере (ради «Показать ещё»), и всё, что ему
 * передано, уезжает туда целиком. Полный товар — это три десятка
 * размеров с объектом цены, картинками и опциями у каждого: раздел
 * «Брюки» весил 2,7 МБ, и переходы по каталогу заметно тормозили.
 * Карточке нужны название, фото, цвет и модель, самая низкая цена и
 * строка размеров — их и оставляем.
 */
const ценаКарточки = (в: any) =>
  в?.calculated_price
    ? {
        calculated_amount: в.calculated_price.calculated_amount,
        original_amount: в.calculated_price.original_amount,
        currency_code: в.calculated_price.currency_code,
        calculated_price: {
          price_list_type: в.calculated_price.calculated_price?.price_list_type,
        },
      }
    : undefined

const можноКупить = (в: any) =>
  в.manage_inventory === false ||
  в.allow_backorder === true ||
  typeof в.inventory_quantity !== "number" ||
  в.inventory_quantity > 0

/**
 * Варианты, сжатые до нужного карточке: по одному на размер и одна цена.
 *
 * У модели три десятка вариантов (размер × рост), и у каждого свой объект
 * цены — на странице каталога это 640 вариантов и четверть мегабайта в
 * разметке. Карточка же показывает только самую низкую цену и строку
 * размеров, где размер есть, если он есть хоть в одном росте. Поэтому
 * оставляем один вариант на размер с ответом «есть или нет», а цену —
 * только самую низкую, у первого.
 */
const вариантыКарточки = (варианты: any[]) => {
  const дешёвый = варианты
    .filter((в) => в.calculated_price)
    .sort(
      (а, б) =>
        (а.calculated_price.calculated_amount ?? 0) -
        (б.calculated_price.calculated_amount ?? 0)
    )[0]

  const поРазмеру = new Map<string, { опция: any; есть: boolean }>()
  for (const в of варианты) {
    const опция = (в.options ?? []).find(
      (о: any) => (о.option?.title ?? "").trim().toLowerCase() === "размер"
    )
    const ключ = опция?.value?.trim() ?? ""
    const уже = поРазмеру.get(ключ)
    поРазмеру.set(ключ, {
      опция: уже?.опция ?? опция,
      есть: (уже?.есть ?? false) || можноКупить(в),
    })
  }

  return [...поРазмеру.values()].map(({ опция, есть }, и) => ({
    id: `r${и}`,
    manage_inventory: true,
    allow_backorder: false,
    inventory_quantity: есть ? 1 : 0,
    options: опция
      ? [{ value: опция.value, option: { title: опция.option?.title } }]
      : [],
    calculated_price: и === 0 ? ценаКарточки(дешёвый) : undefined,
  }))
}

export const дляКарточки = (
  p: HttpTypes.StoreProduct
): HttpTypes.StoreProduct =>
  ({
    id: p.id,
    handle: p.handle,
    title: p.title,
    thumbnail: p.thumbnail,
    images: (p.images ?? []).map((и) => ({ id: и.id, url: и.url })),
    metadata: {
      color: p.metadata?.color,
      model: p.metadata?.model,
    },
    variants: вариантыКарточки(p.variants ?? []),
  }) as unknown as HttpTypes.StoreProduct
