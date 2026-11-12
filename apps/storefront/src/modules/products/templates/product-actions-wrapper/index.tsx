import { listProducts, ПОЛЯ_ТОВАРА } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import ProductActions from "@modules/products/components/product-actions"

/**
 * Fetches real time pricing for a product and renders the product actions component.
 */
export default async function ProductActionsWrapper({
  id,
  region,
  таблицы,
}: {
  id: string
  region: HttpTypes.StoreRegion
  таблицы?: string[]
}) {
  const product = await listProducts({
    // кнопкам нужен товар целиком: опции, остатки, картинки размеров
    queryParams: { id: [id], fields: ПОЛЯ_ТОВАРА } as any,
    regionId: region.id,
    // страница товара открылась по ссылке — значит, и скрытый (метка
    // skryt, например «Проверка оплаты») должен продаваться
    сСкрытыми: true,
  }).then(({ response }) => response.products[0])

  if (!product) {
    return null
  }

  return <ProductActions product={product} region={region} таблицы={таблицы} />
}
