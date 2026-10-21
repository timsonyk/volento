import { HttpTypes } from "@medusajs/types"
import Image from "next/image"

/**
 * Фотографии товара.
 *
 * На телефоне — листалка вбок: снимок занимает почти всю ширину, а край
 * следующего выглядывает справа, чтобы было видно, что фото не одно.
 * Прилипание к краю не даёт остановиться на полпути между снимками.
 *
 * На компьютере снимки идут столбцом: страница листается привычно, а
 * рядом справа стоят сведения о товаре.
 *
 * Кадр 2:3 — тот же, что в карточках каталога, чтобы товар не «прыгал»
 * при переходе из списка.
 */
type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
}

const ImageGallery = ({ images }: ImageGalleryProps) => {
  if (!images.length) {
    return null
  }

  return (
    <div
      className="no-scrollbar flex snap-x snap-mandatory gap-x-1.5 overflow-x-auto pl-4 pr-4 small:flex-col small:gap-y-1.5 small:overflow-visible small:p-0"
      data-testid="product-gallery"
    >
      {images.map((image, index) =>
        image.url ? (
          <div
            key={image.id}
            className="relative aspect-[2/3] w-[92vw] shrink-0 snap-start overflow-hidden bg-mist small:w-full"
          >
            <Image
              src={image.url}
              priority={index <= 1}
              alt={`Фото товара ${index + 1}`}
              fill
              sizes="(max-width: 1024px) 92vw, 38vw"
              className="object-cover object-center"
            />
          </div>
        ) : null
      )}
    </div>
  )
}

export default ImageGallery
