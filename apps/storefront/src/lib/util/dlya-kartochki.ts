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
    variants: (p.variants ?? []).map((в: any) => ({
      id: в.id,
      inventory_quantity: в.inventory_quantity,
      manage_inventory: в.manage_inventory,
      allow_backorder: в.allow_backorder,
      options: (в.options ?? []).map((о: any) => ({
        value: о.value,
        option: { title: о.option?.title },
      })),
      calculated_price: в.calculated_price
        ? {
            calculated_amount: в.calculated_price.calculated_amount,
            original_amount: в.calculated_price.original_amount,
            currency_code: в.calculated_price.currency_code,
            calculated_price: {
              price_list_type: в.calculated_price.calculated_price?.price_list_type,
            },
          }
        : undefined,
    })),
  }) as unknown as HttpTypes.StoreProduct
