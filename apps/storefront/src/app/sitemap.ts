import type { MetadataRoute } from "next"

import { listCategories } from "@lib/data/categories"
import { listProducts } from "@lib/data/products"
import { getBaseURL } from "@lib/util/env"

/**
 * Карта сайта для поисковиков: главная, разделы и карточки товаров.
 *
 * Считается при сборке и живёт сутки. Пересобирать её на каждый запрос
 * нельзя: товаров почти четыреста, и запрос к каталогу с ценами весит
 * мегабайты.
 *
 * Пока индексация закрыта (см. robots.ts), карта всё равно строится —
 * так её видно и можно проверить до запуска.
 */
export const revalidate = 86400

const СТРАНА = process.env.NEXT_PUBLIC_DEFAULT_REGION || "ru"

/** Служебные карточки (баннер главной) в карту не попадают. */
const годится = (т: any) => !!т?.handle && т.handle !== "home-banner"

const СТРАНИЦЫ = [
  "",
  "/store",
  "/o-brende",
  "/dostavka",
  "/oplata",
  "/vozvrat",
  "/oferta",
  "/politika",
  "/soglashenie",
  "/soglasie",
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const адрес = getBaseURL()
  const сейчас = new Date()

  const обычные: MetadataRoute.Sitemap = СТРАНИЦЫ.map((п) => ({
    url: `${адрес}/${СТРАНА}${п}`,
    lastModified: сейчас,
    changeFrequency: п === "" ? "daily" : "monthly",
    priority: п === "" ? 1 : 0.5,
  }))

  try {
    const { response } = await listProducts({
      countryCode: СТРАНА,
      queryParams: { limit: 1000, fields: "handle,updated_at" } as any,
    })

    const товары: MetadataRoute.Sitemap = (response?.products ?? [])
      .filter(годится)
      .map((т: any) => ({
        url: `${адрес}/${СТРАНА}/products/${т.handle}`,
        lastModified: т.updated_at ? new Date(т.updated_at) : сейчас,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }))

    const { product_categories: разделы } = await listCategories({ limit: 200 })
    const рубрики: MetadataRoute.Sitemap = (разделы ?? []).map((р) => ({
      url: `${адрес}/${СТРАНА}/categories/${р.handle}`,
      lastModified: сейчас,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))

    return [...обычные, ...рубрики, ...товары]
  } catch (ошибка) {
    // Каталог не ответил — отдаём хотя бы постоянные страницы: пустая
    // карта хуже неполной.
    console.error("Карта сайта: каталог не ответил", ошибка)
    return обычные
  }
}


