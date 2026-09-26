"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"

import { getAuthHeaders, getCacheOptions } from "./cookies"

/**
 * Остатки по размерам для товаров из корзины.
 *
 * Зачем отдельным запросом: в ответе корзины Medusa у варианта есть
 * manage_inventory и allow_backorder, но самого inventory_quantity нет —
 * его считает только выдача товаров. Без него корзина либо предлагала
 * купить десять штук любого размера, либо (если считать отсутствие поля
 * нулём) кричала «нет в наличии» на то, что есть.
 *
 * Возвращает «сколько осталось» по id варианта. Размеры без поштучного
 * учёта в карту не попадают: для них ограничения нет.
 */
export const остаткиКорзины = async (
  cart: HttpTypes.StoreCart | null
): Promise<Record<string, number>> => {
  const иды = [
    ...new Set(
      (cart?.items ?? [])
        .map((i) => i.product_id)
        .filter((id): id is string => !!id)
    ),
  ]

  if (!иды.length) {
    return {}
  }

  const headers = { ...(await getAuthHeaders()) }
  const next = { ...(await getCacheOptions("products")) }

  try {
    const { products } = await sdk.client.fetch<{
      products: {
        variants?: {
          id: string
          inventory_quantity?: number
          manage_inventory?: boolean
          allow_backorder?: boolean
        }[]
      }[]
    }>("/store/products", {
      method: "GET",
      query: {
        id: иды,
        limit: иды.length,
        fields:
          "id,variants.id,+variants.inventory_quantity,+variants.manage_inventory,+variants.allow_backorder",
      },
      headers,
      next,
    })

    const карта: Record<string, number> = {}
    for (const p of products ?? []) {
      for (const v of p.variants ?? []) {
        if (v.manage_inventory === false || v.allow_backorder) {
          continue
        }
        карта[v.id] = v.inventory_quantity ?? 0
      }
    }
    return карта
  } catch (e) {
    // Не смогли узнать остатки — не мешаем покупать: список количества
    // останется прежним, а нехватку поймает склад при оформлении.
    console.error("Не удалось получить остатки для корзины", e)
    return {}
  }
}
