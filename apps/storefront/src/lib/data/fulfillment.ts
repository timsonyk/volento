"use server"

import { sdk } from "@lib/config"
import type {
  ApishipCalculation,
  ApishipPoint,
} from "@modules/checkout/components/shipping/apiship/types"
import { HttpTypes } from "@medusajs/types"
import { getAuthHeaders, getCacheOptions } from "./cookies"

export const listCartShippingMethods = async (cartId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("fulfillment")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreShippingOptionListResponse>(
      `/store/shipping-options`,
      {
        method: "GET",
        query: {
          cart_id: cartId,
        },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ shipping_options }) => shipping_options)
    .catch(() => {
      return null
    })
}

export const calculatePriceForShippingOption = async (
  optionId: string,
  cartId: string,
  data?: Record<string, unknown>
) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("fulfillment")),
  }

  const body = { cart_id: cartId, data }

  if (data) {
    body.data = data
  }

  return sdk.client
    .fetch<{ shipping_option: HttpTypes.StoreCartShippingOption }>(
      `/store/shipping-options/${optionId}/calculate`,
      {
        method: "POST",
        body,
        headers,
        next,
      }
    )
    .then(({ shipping_option }) => shipping_option)
    .catch((_e) => {
      return null
    })
}

export const retrieveCalculation = async (
  cartId: string,
  shippingOptionId: string
): Promise<ApishipCalculation | null> => {
  const headers = {
    ...(await getAuthHeaders()),

  }

  const next = {
    ...(await getCacheOptions("fulfillment")),
  }

  const body = { cart_id: cartId }

  return sdk.client
    .fetch<{ calculation: ApishipCalculation }>(
      `/store/apiship/${shippingOptionId}/calculate`,
      {
        method: "POST",
        headers,
        body,
        next,
      }
    )
    .then(({ calculation }) => ({
      deliveryToDoor: (calculation.deliveryToDoor ?? []).flatMap((group) => {
        if (!group.providerKey) {
          return []
        }

        return [
          {
            providerKey: group.providerKey,
            tariffs: group.tariffs,
          },
        ]
      }),
      deliveryToPoint: (calculation.deliveryToPoint ?? []).flatMap((group) => {
        if (!group.providerKey) {
          return []
        }

        return [
          {
            providerKey: group.providerKey,
            tariffs: group.tariffs,
          },
        ]
      }),
    }))
    .catch(() => {
      // расчёт не критичен: покажем список без цен, чем уроним оформление
      return null
    })
}

/**
 * Адреса пунктов выдачи по их номерам.
 *
 * Номеров приходит много — в Москве это тысячи. Одним запросом их не
 * спросить: адрес запроса вырастает до десятков тысяч знаков, и сервер
 * отвечает «Request-URI Too Large». Поэтому спрашиваем порциями.
 */
const РАЗМЕР_ПОРЦИИ = 150

/**
 * Короткий отпечаток списка пунктов. Нужен в ключе кеша: без него ответ
 * для первого выбранного города залипал и подставлялся всем следующим.
 */
const отпечаток = (ids: Array<number>): string => {
  let h = 0
  for (const id of ids) {
    h = (Math.imul(h, 31) + id) >>> 0
  }
  return h.toString(36)
}

const ПОЛЯ_ПУНКТА = [
  "id",
  "description",
  "providerKey",
  "name",
  "address",
  "photos",
  "worktime",
  "timetable",
  "lat",
  "lng",
].join(",")

/** Оставляет только пункты, которые можно поставить на карту. */
const пригодные = (points: Array<Record<string, any>>): ApishipPoint[] =>
  (points ?? []).flatMap((point) => {
    if (
      point.id === undefined ||
      point.id === null ||
      point.lat === undefined ||
      point.lat === null ||
      point.lng === undefined ||
      point.lng === null
    ) {
      return []
    }

    return [
      {
        ...point,
        id: String(point.id),
        lat: point.lat,
        lng: point.lng,
        worktime: point.worktime as Record<string, string> | undefined,
      },
    ]
  })

export const getPointAddresses = async (
  cartId: string,
  shippingOptionId: string,
  pointIds: Array<number>
): Promise<{ points: ApishipPoint[] } | null> => {
  if (!pointIds.length) {
    return { points: [] }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("fulfillment")),
  }

  const порции: Array<Array<number>> = []
  for (let i = 0; i < pointIds.length; i += РАЗМЕР_ПОРЦИИ) {
    порции.push(pointIds.slice(i, i + РАЗМЕР_ПОРЦИИ))
  }

  try {
    const ответы = await Promise.all(
      порции.map((порция, n) =>
        sdk.client.fetch<{ points: Array<Record<string, any>> }>(
          `/store/apiship/points`,
          {
            method: "GET",
            headers,
            query: {
              // ключ свой на каждую порцию, иначе порции затрут друг друга,
              // и обязательно с отпечатком самих пунктов — иначе при смене
              // города вернутся точки прошлого
              key: `apiship:points:${cartId}:${shippingOptionId}:${n}:${отпечаток(порция)}`,
              filter: `id=[${порция.join(",")}]`,
              fields: ПОЛЯ_ПУНКТА,
              shipping_option_id: shippingOptionId,
            },
            next,
          }
        )
      )
    )

    return { points: ответы.flatMap((о) => пригодные(о.points)) }
  } catch (e) {
    console.error("ApiShip: не удалось получить пункты выдачи", e)
    return null
  }
}

export const retrieveProviders = async (
  shippingOptionId?: string
): Promise<{ providers: Array<{ key: string; name?: string }> } | null> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("fulfillment")),
  }

  return sdk.client
    .fetch<{ providers: Array<{ key: string; name?: string }> }>(
      `/store/apiship/providers`,
      {
        method: "GET",
        headers,
        query: {
          shipping_option_id: shippingOptionId,
        },
        next,
      }
    )
    .catch((e) => {
      console.error("ApiShip: не удалось получить список служб", e)
      return null
    })
}
