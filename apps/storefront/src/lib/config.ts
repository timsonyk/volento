import { getLocaleHeader } from "@lib/util/get-locale-header"
import Medusa, { FetchArgs, FetchInput } from "@medusajs/js-sdk"

// Defaults to standard port for Medusa server
let MEDUSA_BACKEND_URL = "http://localhost:9000"

if (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL) {
  MEDUSA_BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
}

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
})

/**
 * Пропуск к оформлению заказа, пока магазин не открыт (на бэкенде —
 * lib/zamok-zakazov.ts). Ключ серверный, без NEXT_PUBLIC_: в браузер он
 * не попадает, поэтому и подставляем его только на сервере.
 */
const ключВитрины = (): Record<string, string> =>
  typeof window === "undefined" && process.env.VITRINA_KLYUCH
    ? { "x-vitrina-klyuch": process.env.VITRINA_KLYUCH }
    : {}

const originalFetch = sdk.client.fetch.bind(sdk.client)

sdk.client.fetch = async <T>(
  input: FetchInput,
  init?: FetchArgs
): Promise<T> => {
  const headers = init?.headers ?? {}
  let localeHeader: Record<string, string | null> | undefined
  try {
    localeHeader = await getLocaleHeader()
    headers["x-medusa-locale"] ??= localeHeader["x-medusa-locale"]
  } catch {}

  const newHeaders = {
    ...localeHeader,
    ...headers,
    ...ключВитрины(),
  }
  init = {
    ...init,
    headers: newHeaders,
  }
  return originalFetch(input, init)
}
