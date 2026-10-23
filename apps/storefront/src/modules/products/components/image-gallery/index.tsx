"use client"

import { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import { useState } from "react"

import Просмотр from "@modules/products/components/prosmotr"

/**
 * Фотографии товара.
 *
 * На телефоне — листалка вбок: снимок занимает почти всю ширину, а край
 * следующего выглядывает справа, чтобы было видно, что фото не одно.
 * Прилипание к краю не даёт остановиться на полпути между снимками.
 *
 * На компьютере снимки идут столбцом: страница листается колесом, а
 * рядом справа стоят сведения о товаре. Каждый снимок целиком помещается
 * в экран под шапкой — раньше кадр 2:3 в 38 % ширины выходил выше экрана
 * (встреча 23 октября). Ширина столбца поэтому следует из высоты окна.
 *
 * Нажатие на снимок открывает его во весь экран.
 *
 * Кадр 2:3 — тот же, что в карточках каталога, чтобы товар не «прыгал»
 * при переходе из списка.
 */
type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
}

const ImageGallery = ({ images }: ImageGalleryProps) => {
  const [открыт, setОткрыт] = useState<number | null>(null)
  const снимки = images.filter((i) => i.url)

  if (!снимки.length) {
    return null
  }

  return (
    <>
      <div
        className="no-scrollbar flex snap-x snap-mandatory gap-x-1.5 overflow-x-auto pl-4 pr-4 small:flex-col small:items-start small:gap-y-1.5 small:overflow-visible small:p-0"
        data-testid="product-gallery"
      >
        {снимки.map((image, index) => (
          <button
            type="button"
            key={image.id}
            onClick={() => setОткрыт(index)}
            aria-label={`Увеличить фото ${index + 1}`}
            className="relative block aspect-[2/3] w-[92vw] shrink-0 snap-start cursor-zoom-in overflow-hidden bg-mist small:h-[calc(100vh-8.5rem)] small:max-h-[1100px] small:w-auto"
          >
            <Image
              src={image.url!}
              priority={index <= 1}
              alt={`Фото товара ${index + 1}`}
              fill
              sizes="(max-width: 1024px) 92vw, 34vw"
              className="object-cover object-center"
            />
          </button>
        ))}
      </div>

      {открыт !== null && (
        <Просмотр
          снимки={снимки.map((i) => i.url!)}
          начало={открыт}
          подпись="Фото товара"
          закрыть={() => setОткрыт(null)}
        />
      )}
    </>
  )
}

export default ImageGallery
