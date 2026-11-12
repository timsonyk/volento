import React, { Suspense } from "react"

import { HttpTypes } from "@medusajs/types"
import Breadcrumbs from "@modules/products/components/breadcrumbs"
import ColorSelect from "@modules/products/components/color-select"
import ImageGallery from "@modules/products/components/image-gallery"
import ProductActions from "@modules/products/components/product-actions"
import ProductTabs from "@modules/products/components/product-tabs"
import RelatedProducts from "@modules/products/components/related-products"
import ProductInfo, { stripColor } from "@modules/products/templates/product-info"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
  /** таблица мерок отдельно от фотографий (lib/util/tablica-mer.ts) */
  таблицы?: string[]
}

/**
 * Карточка товара.
 *
 * На телефоне всё идёт сверху вниз: крошки, листалка фотографий, название,
 * цена, описание, цвет, размеры, кнопка. Фотографии во всю ширину, поэтому
 * поля даёт не общий контейнер, а сами блоки.
 *
 * На компьютере два столбца: слева фотографии, справа сведения — они
 * прилипают к верху, чтобы кнопка «в корзину» оставалась на виду, пока
 * листаешь снимки. Раньше столбца было три (сведения слева, фото в
 * середине, кнопки справа) — читать приходилось зигзагом.
 *
 * Ширина фотографий следует из высоты окна: снимок целиком помещается в
 * экран (image-gallery). Раньше было 38 % ширины, и на широком мониторе
 * кадр 2:3 выходил выше экрана.
 */
const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  images,
  таблицы = [],
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  const color = product.metadata?.color as string | undefined

  const сведения = (
    <>
      <ProductInfo product={product} />
      <Suspense fallback={null}>
        <ColorSelect product={product} countryCode={countryCode} />
      </Suspense>
      {/* Кнопки рисуем сразу из товара, который страница уже получила.
          Раньше здесь был второй запрос того же товара (по id) и заглушка
          с выключенными кнопками, пока он идёт: лишняя секунда ожидания и
          миг, когда на странице две кнопки «В корзину». */}
      <ProductActions product={product} region={region} таблицы={таблицы} />
      <ProductTabs product={product} />
    </>
  )

  return (
    <>
      <div data-testid="product-container">
        <div className="px-4 py-4 small:px-[50px] small:py-6">
          <Breadcrumbs
            product={product}
            название={stripColor(product.title, color)}
          />
        </div>

        <div className="small:flex small:items-start small:gap-x-[7%] small:px-[50px] small:pb-16">
          <div className="small:shrink-0">
            <ImageGallery images={images} />
          </div>

          <div className="flex flex-col gap-y-6 px-4 pb-12 pt-8 small:sticky small:top-32 small:max-w-[560px] small:flex-1 small:px-0 small:pt-0">
            {сведения}
          </div>
        </div>
      </div>

      <div
        className="content-container my-16 small:my-24"
        data-testid="related-products-container"
      >
        <Suspense fallback={<SkeletonRelatedProducts />}>
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>
      </div>
    </>
  )
}

export default ProductTemplate
