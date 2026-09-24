"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"

import { getAuthHeaders, getCacheOptions } from "./cookies"

/**
 * Признаки для фильтра каталога: сезон, покрой, цвет, новинки.
 *
 * Считаются по лёгкой выписке всего каталога — без региона, а значит без
 * цен. Это принципиально: те же 394 товара с ценами весят 3,6 МБ и
 * считаются 2,6 секунды, а без них — 252 КБ и 0,15 секунды.
 *
 * Дальше отбор идёт у нас: пересекаем списки товаров по каждому
 * выбранному признаку и отдаём готовые id. У Medusa условия по разделу
 * и по списку id складываются по И, так что фильтр работает и внутри
 * раздела.
 */

/** Метка, которой в админке помечают новинки. */
export const МЕТКА_НОВИНКИ = "новинка"

export type Признак = {
  значение: string
  сколько: number
  /** только у цвета: код для кружка */
  код?: string
}

export type Признаки = {
  сезоны: Признак[]
  покрои: Признак[]
  цвета: Признак[]
  новинок: number
}

export type ВыбранныеФильтры = {
  сезон?: string[]
  покрой?: string[]
  цвет?: string[]
  новинки?: boolean
}

type Лёгкий = {
  id: string
  created_at?: string
  metadata?: Record<string, unknown> | null
  tags?: { value?: string }[] | null
  categories?: { id?: string }[] | null
}

const строка = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : undefined

/** Цвет приходит как «бежевый, темно-бежевый» — берём первый. */
const первыйЦвет = (v: unknown) => строка(v)?.split(",")[0].trim()

const новинка = (p: Лёгкий) =>
  (p.tags ?? []).some(
    (t) => (t.value ?? "").trim().toLowerCase() === МЕТКА_НОВИНКИ
  )

/** Вся выписка каталога: id, дата, метаданные, метки. Без цен. */
const выписка = async (): Promise<Лёгкий[]> => {
  const headers = { ...(await getAuthHeaders()) }
  const next = { ...(await getCacheOptions("products")) }

  try {
    const { products } = await sdk.client.fetch<{ products: Лёгкий[] }>(
      "/store/products",
      {
        method: "GET",
        query: {
          limit: 1000,
          fields: "id,created_at,metadata,+tags,+categories.id",
        },
        headers,
        next,
        cache: "force-cache",
      }
    )
    return products ?? []
  } catch (e) {
    console.error("Не удалось получить выписку каталога для фильтра", e)
    return []
  }
}

/** Что вообще можно выбрать в фильтре и сколько за каждым товаров. */
export const собратьПризнаки = async (
  идыРаздела?: string[]
): Promise<Признаки> => {
  const все = await выписка()
  // в разделе считаем только его товары, иначе числа рядом с галочками
  // показывали бы весь магазин
  const свои = идыРаздела?.length
    ? все.filter((p) =>
        (p.categories ?? []).some((c) => c.id && идыРаздела.includes(c.id))
      )
    : все

  const сезоны = new Map<string, number>()
  const покрои = new Map<string, number>()
  const цвета = new Map<string, { сколько: number; код?: string }>()
  let новинок = 0

  for (const p of свои) {
    const m = p.metadata ?? {}
    const s = строка(m.season)
    const c = строка(m.cut)
    const col = первыйЦвет(m.color)

    if (s) сезоны.set(s, (сезоны.get(s) ?? 0) + 1)
    if (c) покрои.set(c, (покрои.get(c) ?? 0) + 1)
    if (col) {
      const было = цвета.get(col)
      цвета.set(col, {
        сколько: (было?.сколько ?? 0) + 1,
        код: было?.код ?? строка(m.color_hex),
      })
    }
    if (новинка(p)) новинок++
  }

  const вСписок = (m: Map<string, number>): Признак[] =>
    [...m.entries()]
      .map(([значение, сколько]) => ({ значение, сколько }))
      .sort((a, b) => b.сколько - a.сколько || a.значение.localeCompare(b.значение))

  return {
    сезоны: вСписок(сезоны),
    покрои: вСписок(покрои),
    цвета: [...цвета.entries()]
      .map(([значение, v]) => ({ значение, сколько: v.сколько, код: v.код }))
      .sort((a, b) => b.сколько - a.сколько || a.значение.localeCompare(b.значение)),
    новинок,
  }
}

/**
 * Товары, подходящие под выбранные фильтры.
 *
 * Внутри одного признака — «или» (чёрный или синий), между признаками —
 * «и» (чёрный И прямой). Так фильтры ведут себя в любом магазине.
 *
 * Возвращает null, если не выбрано ничего: значит фильтровать не надо и
 * список id в запрос подставлять не нужно.
 */
export const найтиТовары = async (
  фильтры: ВыбранныеФильтры,
  идыРаздела?: string[]
): Promise<string[] | null> => {
  const естьЧто =
    фильтры.сезон?.length ||
    фильтры.покрой?.length ||
    фильтры.цвет?.length ||
    фильтры.новинки

  if (!естьЧто) {
    return null
  }

  const всеТовары = await выписка()
  const все = идыРаздела?.length
    ? всеТовары.filter((p) =>
        (p.categories ?? []).some((c) => c.id && идыРаздела.includes(c.id))
      )
    : всеТовары

  const подходит = (p: Лёгкий) => {
    const m = p.metadata ?? {}
    if (фильтры.сезон?.length && !фильтры.сезон.includes(строка(m.season) ?? "")) {
      return false
    }
    if (фильтры.покрой?.length && !фильтры.покрой.includes(строка(m.cut) ?? "")) {
      return false
    }
    if (фильтры.цвет?.length && !фильтры.цвет.includes(первыйЦвет(m.color) ?? "")) {
      return false
    }
    if (фильтры.новинки && !новинка(p)) {
      return false
    }
    return true
  }

  // новые сверху: тем же порядком, что и «Новинки» в сортировке
  return все
    .filter(подходит)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .map((p) => p.id)
}

/** Разбирает фильтры из адреса страницы. */
export const прочитатьФильтры = async (
  params: Record<string, string | string[] | undefined>
): Promise<ВыбранныеФильтры> => {
  const список = (v: string | string[] | undefined) =>
    typeof v === "string" ? v.split("~").filter(Boolean) : v

  return {
    сезон: список(params["сезон"]),
    покрой: список(params["покрой"]),
    цвет: список(params["цвет"]),
    новинки: params["новинки"] === "да",
  }
}

export type { HttpTypes }
