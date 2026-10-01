import { HttpTypes } from "@medusajs/types";

export const isSimpleProduct = (product: HttpTypes.StoreProduct): boolean => {
    return product.options?.length === 1 && product.options[0].values?.length === 1;
}

/**
 * Можно ли купить хоть один размер. Главная показывает только такие
 * товары: витрина с распроданной моделью в первом ряду обещает то,
 * чего нет. Для проверки товар нужно запросить с полями
 * +variants.inventory_quantity,+variants.manage_inventory,+variants.allow_backorder.
 */
export const естьВНаличии = (product: HttpTypes.StoreProduct): boolean =>
  (product.variants ?? []).some(
    (в) =>
      в.manage_inventory === false ||
      в.allow_backorder === true ||
      (в.inventory_quantity ?? 0) > 0
  )
