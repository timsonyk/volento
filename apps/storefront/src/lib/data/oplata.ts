"use server"

import { sdk } from "@lib/config"
import { revalidateTag } from "next/cache"

import { getAuthHeaders, getCacheTag, getCartId, removeCartId } from "./cookies"

/**
 * Оплата через Точку: покупатель уходит на страницу банка и
 * возвращается к нам на /checkout/oplata.
 */

/** Ссылка на страницу оплаты в банке, или текст ошибки. */
export async function ссылкаНаОплату(
  countryCode: string
): Promise<{ ссылка: string } | { ошибка: string }> {
  const cartId = await getCartId()

  if (!cartId) {
    return { ошибка: "Корзина не найдена, обновите страницу" }
  }

  try {
    const ответ = await sdk.client.fetch<{ ssylka: string }>("/store/oplata/tochka", {
      method: "POST",
      headers: { ...(await getAuthHeaders()) },
      body: { cart_id: cartId, country_code: countryCode },
    })
    return { ссылка: ответ.ssylka }
  } catch (e: any) {
    return { ошибка: e?.message || "Не удалось перейти к оплате, попробуйте ещё раз" }
  }
}

export type ИтогОплаты =
  | { заказ: string; страна: string }
  | { ждём: true }
  | { ошибка: string }

/**
 * Пробует превратить оплаченную корзину в заказ.
 *
 * Банк подтверждает оплату не мгновенно, поэтому «ещё не оплачено» здесь
 * не ошибка, а повод спросить снова. Если заказ уже создал вебхук банка
 * (человек долго не возвращался), Medusa просто вернёт готовый заказ.
 */
export async function завершитьОплату(cartId: string): Promise<ИтогОплаты> {
  if (!/^cart_[A-Za-z0-9]+$/.test(cartId)) {
    return { ошибка: "Неверная ссылка" }
  }

  try {
    const ответ = await sdk.store.cart.complete(cartId, {}, {
      ...(await getAuthHeaders()),
    })

    if (ответ?.type === "order") {
      revalidateTag(await getCacheTag("carts"))
      revalidateTag(await getCacheTag("orders"))

      if ((await getCartId()) === cartId) {
        await removeCartId()
      }

      return {
        заказ: ответ.order.id,
        страна: ответ.order.shipping_address?.country_code?.toLowerCase() || "ru",
      }
    }

    return { ждём: true }
  } catch (e: any) {
    // Чаще всего это «оплата ещё не подтверждена» — пробуем ещё раз.
    // Остальное увидим в журнале бэкенда.
    return { ждём: true }
  }
}
