"use server"

/**
 * Данные покупателя. Входа по паролю здесь больше нет: вход и
 * регистрация идут по коду из письма — см. lib/data/vhod.ts.
 */

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import {
  getAuthHeaders,
  getCacheTag,
  getCartId,
  removeAuthToken,
  removeCartId,
} from "./cookies"

export const retrieveCustomer =
  async (): Promise<HttpTypes.StoreCustomer | null> => {
    const authHeaders = await getAuthHeaders()

    if (!authHeaders) return null

    const headers = {
      ...authHeaders,
    }

    return await sdk.client
      .fetch<{ customer: HttpTypes.StoreCustomer }>(`/store/customers/me`, {
        method: "GET",
        // заказы покупателя здесь не просим: их никто не читал, а запрос
        // с ними шёл на каждой странице (список заказов — lib/data/orders)
        headers,
        // Покупателя не кэшируем: запрос лёгкий, около 10 мс, повторные
        // вызовы в пределах одной страницы склеиваются сами, а с кэшем
        // пришлось бы следить за его сбросом после каждой правки профиля.
        cache: "no-store",
      })
      .then(({ customer }) => customer)
      .catch(() => null)
  }

export const updateCustomer = async (body: HttpTypes.StoreUpdateCustomer) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const updateRes = await sdk.store.customer
    .update(body, {}, headers)
    .then(({ customer }) => customer)
    .catch(medusaError)

  // Кэш здесь сбрасывать незачем: покупатель не кэшируется (см.
  // retrieveCustomer). Свежую страницу вызывающий просит сам через
  // router.refresh(), а только что сохранённое значение показывает из
  // своего состояния, потому что перерисовка изредка не срабатывает.
  return updateRes
}

export async function signout(countryCode: string) {
  await sdk.auth.logout()

  await removeAuthToken()

  const customerCacheTag = await getCacheTag("customers")
  revalidateTag(customerCacheTag)

  await removeCartId()

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)

  redirect(`/${countryCode}/account`)
}

export async function transferCart() {
  const cartId = await getCartId()

  if (!cartId) {
    return
  }

  const headers = await getAuthHeaders()

  await sdk.store.cart.transferCart(cartId, {}, headers)

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)
}
