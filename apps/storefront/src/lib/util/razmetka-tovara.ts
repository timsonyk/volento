import { HttpTypes } from "@medusajs/types"

import { цветСЁ } from "./cvet-s-yo"
import { getProductPrice } from "./get-product-price"

/**
 * Описание товара для поисковиков и соцсетей: первые ~160 знаков
 * описания одной строкой. Без описания — название с составом, если он
 * есть, чтобы сниппет в выдаче не повторял заголовок слово в слово.
 */
export function описаниеДляПоиска(product: HttpTypes.StoreProduct): string {
  const текст = (product.description ?? "").replace(/\s+/g, " ").trim()
  if (текст) {
    return текст.length > 160 ? `${текст.slice(0, 157).trimEnd()}…` : текст
  }
  const состав = product.metadata?.sostav
  return [product.title, typeof состав === "string" && состав ? `Состав: ${состав}` : "", "Volento"]
    .filter(Boolean)
    .join(". ")
}

const естьВНаличии = (product: HttpTypes.StoreProduct) =>
  (product.variants ?? []).some(
    (v) =>
      !v.manage_inventory || v.allow_backorder || (v.inventory_quantity ?? 0) > 0
  )

/**
 * Разметка schema.org/Product: по ней Яндекс и Google показывают в выдаче
 * цену и наличие. Если размеры стоят одинаково, отдаём одну цену. Если
 * по-разному (большие размеры дороже), отдаём вилку «от и до»: одна
 * низшая цена обещала бы в выдаче то, чего у большинства размеров нет.
 */
export function разметкаТовара(
  product: HttpTypes.StoreProduct,
  адрес: string
): Record<string, unknown> {
  const { cheapestPrice } = getProductPrice({ product })
  const снимки = [product.thumbnail, ...(product.images ?? []).map((i) => i.url)]
    .filter((s): s is string => !!s)
    .filter((s, i, все) => все.indexOf(s) === i)
    .slice(0, 6)
  const цены = (product.variants ?? [])
    .map((v) => Number((v as any).calculated_price?.calculated_amount))
    .filter((ц) => Number.isFinite(ц) && ц > 0)
  const низшая = цены.length ? Math.min(...цены) : 0
  const высшая = цены.length ? Math.max(...цены) : 0
  const наличие = естьВНаличии(product)
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock"
  const артикул = product.metadata?.article
  const цвет = product.metadata?.color

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: цветСЁ(product.title),
    description: описаниеДляПоиска(product),
    ...(typeof цвет === "string" && цвет.trim() ? { color: цветСЁ(цвет.trim()) } : {}),
    image: снимки,
    ...(typeof артикул === "string" && артикул ? { sku: артикул } : {}),
    brand: { "@type": "Brand", name: "Volento" },
    ...(cheapestPrice
      ? {
          offers:
            высшая > низшая
              ? {
                  "@type": "AggregateOffer",
                  url: адрес,
                  priceCurrency: (cheapestPrice.currency_code ?? "rub").toUpperCase(),
                  lowPrice: низшая,
                  highPrice: высшая,
                  offerCount: цены.length,
                  availability: наличие,
                }
              : {
                  "@type": "Offer",
                  url: адрес,
                  priceCurrency: (cheapestPrice.currency_code ?? "rub").toUpperCase(),
                  price: cheapestPrice.calculated_price_number,
                  availability: наличие,
                },
        }
      : {}),
  }
}
