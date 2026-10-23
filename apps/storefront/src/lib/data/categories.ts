import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const listCategories = async (query?: Record<string, unknown>) => {
  const next = {
    ...(await getCacheOptions("categories")),
  }

  const limit = query?.limit || 100

  return sdk.client
    .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
      "/store/product-categories",
      {
        query: {
          // *products отсюда убран намеренно: меню и подвалу нужны
          // только названия, а с боевым каталогом этот запрос весил
          // 6,3 МБ и выполнялся при каждой отрисовке страницы
          fields:
            "id, name, handle, rank, *category_children, *parent_category, *parent_category.parent_category",
          limit,
          ...query,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories)
}

export const getCategoryByHandle = async (categoryHandle: string[]) => {
  const handle = `${categoryHandle.join("/")}`

  const next = {
    ...(await getCacheOptions("categories")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(
      `/store/product-categories`,
      {
        query: {
          // Товары раздела отсюда не берём: их приносит сетка каталога
          // своим запросом. С *products ответ по «Брюкам» весил 2,1 МБ —
          // больше, чем Next держит в кэше, и качался на каждый заход
          fields:
            "id, name, handle, description, *category_children, *parent_category, *parent_category.parent_category",
          handle,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories[0])
}

/**
 * Есть ли в разделе (вместе с подразделами) хоть один товар. Меню не
 * показывает пустые разделы: «Мужские рубашки» заведены, а товаров в них
 * пока нет — ссылка вела бы на пустую страницу (встреча 23 октября).
 * Спрашиваем один товар без полей: ответ — только число.
 */
export const естьТовары = async (idsРаздела: string[]): Promise<boolean> => {
  const next = {
    ...(await getCacheOptions("products")),
  }

  return sdk.client
    .fetch<{ count: number }>("/store/products", {
      query: { category_id: idsРаздела, limit: 1, fields: "id" },
      next,
      cache: "force-cache",
    })
    .then(({ count }) => count > 0)
    // не узнали — показываем: лишняя ссылка лучше пропавшего раздела
    .catch(() => true)
}
