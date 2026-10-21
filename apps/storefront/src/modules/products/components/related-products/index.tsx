import { cookies } from "next/headers"

import { sdk } from "@lib/config"
import { ВИТРИНА } from "@lib/data/cookies"
import { похожиеВНаличии, толькоВНаличии } from "@lib/data/facets"
import { listModelColors, listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"
import SectionHeading from "@modules/home/components/section-heading"

import Product from "../product-preview"
import { СМОТРЕЛИ } from "./smotreli"
import ZapomnitProsmotr from "./zapomnit"

/**
 * Рекомендации под карточкой товара, три ряда по четыре:
 *
 * - «С этим покупают» — что лежало в одних заказах с этим товаром
 *   (бэкенд, /store/s-etim-pokupayut). Пока заказов мало, ряда нет.
 * - «Похожие» — тот же раздел, модель, крой, сезон; по одному цвету от
 *   модели, другие цвета этой — не здесь, они кружками в карточке
 *   (lib/data/facets.ts, похожиеВНаличии).
 * - «Вы смотрели» — последние открытые карточки, из cookie.
 *
 * Во всех рядах только то, что можно купить хоть в одном размере:
 * распроданное покупателя только расстроит. Товар не повторяется в двух
 * рядах. Ряд, где набралось меньше двух карточек, не показываем.
 *
 * Раньше здесь был блок из стартового шаблона: товары той же коллекции с
 * теми же метками, без учёта наличия. Он тянул сотню товаров со всеми
 * размерами — 3,4 МБ, больше, чем Next соглашается держать в кэше, — и
 * скачивал их заново на каждый просмотр карточки.
 */
const В_РЯДУ = 4

const сЭтимПокупают = async (id: string): Promise<string[]> => {
  try {
    const { ids } = await sdk.client.fetch<{ ids: string[] }>(
      "/store/s-etim-pokupayut",
      {
        method: "GET",
        query: { id },
        next: { revalidate: 3600, tags: [ВИТРИНА] },
        cache: "force-cache",
      }
    )
    return ids ?? []
  } catch {
    return []
  }
}

const смотрели = async (id: string): Promise<string[]> => {
  try {
    const значение = (await cookies()).get(СМОТРЕЛИ)?.value ?? ""
    return значение.split(".").filter((x) => x && x !== id)
  } catch {
    return []
  }
}

export default async function RelatedProducts({
  product,
  countryCode,
}: {
  product: HttpTypes.StoreProduct
  countryCode: string
}) {
  const region = await getRegion(countryCode)

  if (!region) {
    return <ZapomnitProsmotr id={product.id} />
  }

  const [вместе, похожие, недавние] = await Promise.all([
    сЭтимПокупают(product.id).then(толькоВНаличии),
    похожиеВНаличии(product.id, В_РЯДУ * 2),
    смотрели(product.id).then(толькоВНаличии),
  ])

  // по порядку рядов: что попало в верхний, в нижних не повторяем
  const занято = new Set<string>()
  const ряд = (ids: string[]) => {
    const свои = ids.filter((id) => !занято.has(id)).slice(0, В_РЯДУ)
    свои.forEach((id) => занято.add(id))
    return свои.length >= 2 ? свои : []
  }
  const ряды = [
    { заголовок: "С этим покупают", ids: ряд(вместе) },
    { заголовок: "Похожие", ids: ряд(похожие) },
    { заголовок: "Вы смотрели", ids: ряд(недавние) },
  ].filter((р) => р.ids.length)

  const всеИды = ряды.flatMap((р) => р.ids)

  if (!всеИды.length) {
    return <ZapomnitProsmotr id={product.id} />
  }

  const { response } = await listProducts({
    regionId: region.id,
    queryParams: { id: всеИды, limit: всеИды.length },
  })
  const поИд = new Map(response.products.map((p) => [p.id, p]))
  const цвета = await listModelColors({ products: response.products, countryCode })

  return (
    <div className="flex flex-col gap-y-16 small:gap-y-24">
      <ZapomnitProsmotr id={product.id} />
      {ряды.map((р) => {
        const товары = р.ids
          .map((id) => поИд.get(id))
          .filter((p): p is HttpTypes.StoreProduct => !!p)
        if (товары.length < 2) {
          return null
        }
        return (
          <section key={р.заголовок} data-testid={`rekomendacii-${р.заголовок}`}>
            <div className="mb-8">
              <SectionHeading>{р.заголовок}</SectionHeading>
            </div>
            <ul className="grid grid-cols-2 gap-x-2 gap-y-7 small:grid-cols-4">
              {товары.map((p) => (
                <li key={p.id}>
                  <Product
                    region={region}
                    product={p}
                    colors={цвета[p.metadata?.model as string]}
                  />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
