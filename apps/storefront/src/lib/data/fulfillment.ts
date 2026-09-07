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

export const getPointAddresses = async (
  cartId: string,
  shippingOptionId: string,
  pointIds: Array<number>
): Promise<{ points: ApishipPoint[] } | null> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("fulfillment")),
  }

  if (!pointIds.length) {
    return {
      points: [],
    }
  }

  const filter = `id=[${pointIds.join(",")}]`
  const fields = [
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
  const key = `apiship:points:${cartId}:${shippingOptionId}`

  return sdk.client
    .fetch<{ points: Array<Record<string, any>> }>(
      `/store/apiship/points`,
      {
        method: "GET",
        headers,
        query: {
          key,
          filter,
          fields,
          shipping_option_id: shippingOptionId,
        },
        next,
      }
    )
    .then(({ points }) => ({
      points: (points ?? []).flatMap((point) => {
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
      }),
    }))
    .catch((e) => {
      console.error("ApiShip: не удалось получить пункты выдачи", e)
      return null
    })
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
