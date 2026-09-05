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

import ProductActionsWrapper from "./product-actions-wrapper"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
}

/**
 * Карточка товара.
 *
 * На телефоне всё идёт сверху вниз: крошки, листалка фотографий, название,
 * цена, описание, цвет, размеры, кнопка. Фотографии во всю ширину, поэтому
 * поля даёт не общий контейнер, а сами блоки.
 *
 * На компьютере два столбца: слева фотографии столбцом, справа сведения —
 * они прилипают к верху, чтобы кнопка «в корзину» оставалась на виду, пока
 * листаешь снимки. Раньше столбца было три (сведения слева, фото в
 * середине, кнопки справа) — читать приходилось зигзагом.
 */
const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  images,
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
      <Suspense
        fallback={
          <ProductActions disabled={true} product={product} region={region} />
        }
      >
        <ProductActionsWrapper id={product.id} region={region} />
      </Suspense>
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

        <div className="small:flex small:items-start small:gap-x-10 small:px-[50px] small:pb-10">
          <div className="small:w-[55%]">
            <ImageGallery images={images} />
          </div>

          <div className="flex flex-col gap-y-8 px-4 pb-12 pt-8 small:sticky small:top-24 small:w-[45%] small:max-w-[440px] small:px-0 small:pt-0">
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
