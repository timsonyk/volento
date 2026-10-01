"use server"

import { sdk } from "@lib/config"

/**
 * id товаров, у которых хоть один размер можно купить (бэкенд,
 * /store/v-nalichii). Каталог, разделы и поиск показывают только их.
 *
 * null — бэкенд не ответил. Тогда не прячем ничего: лучше лишняя
 * распроданная карточка, чем пустой каталог.
 */
export const идыВНаличии = async (): Promise<Set<string> | null> => {
  try {
    const { ids } = await sdk.client.fetch<{ ids: string[] }>("/store/v-nalichii", {
      method: "GET",
      // Остатки меняются, но не каждую секунду: минуты хватает,
      // бэкенд и сам держит ответ столько же
      next: { revalidate: 60 },
    })
    return new Set(ids)
  } catch (e) {
    console.error("Не удалось узнать наличие для каталога", e)
    return null
  }
}
