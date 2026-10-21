import { HttpTypes } from "@medusajs/types"

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
 * цену и наличие. Цена — самая низкая из размеров, в рублях.
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
  const артикул = product.metadata?.article

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: описаниеДляПоиска(product),
    image: снимки,
    ...(typeof артикул === "string" && артикул ? { sku: артикул } : {}),
    brand: { "@type": "Brand", name: "Volento" },
    ...(cheapestPrice
      ? {
          offers: {
            "@type": "Offer",
            url: адрес,
            priceCurrency: (cheapestPrice.currency_code ?? "rub").toUpperCase(),
            price: cheapestPrice.calculated_price_number,
            availability: естьВНаличии(product)
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          },
        }
      : {}),
  }
}
