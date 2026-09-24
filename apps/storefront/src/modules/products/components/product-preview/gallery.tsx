"use client"

import Image from "next/image"
import { useState } from "react"

import PlaceholderImage from "@modules/common/icons/placeholder-image"

/**
 * Картинка карточки со стрелками листания, как на референсе.
 * Стрелки появляются при наведении и только если снимков больше одного.
 * Клик по стрелке не должен уводить на страницу товара — карточка целиком
 * обёрнута в ссылку, поэтому переход гасим.
 */
export default function PreviewGallery({
  images,
  alt,
}: {
  images: string[]
  alt: string
}) {
  const [index, setIndex] = useState(0)

  const step = (event: React.MouseEvent, direction: 1 | -1) => {
    event.preventDefault()
    event.stopPropagation()
    setIndex((i) => (i + direction + images.length) % images.length)
  }

  // Группа названа (group/gallery), поэтому и условие показа должно быть
  // именованным: group-hover:… к ней не относится, и стрелки оставались
  // прозрачными — доехать до них можно было только клавиатурой.
  const arrow =
    "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center bg-paper/90 text-ink opacity-0 transition-opacity duration-200 group-hover/gallery:opacity-100 focus-visible:opacity-100"

  return (
    <div className="group/gallery relative aspect-[2/3] w-full overflow-hidden bg-mist">
      {images.length ? (
        <Image
          src={images[index]}
          alt={alt}
          fill
          quality={80}
          draggable={false}
          sizes="(max-width: 576px) 68vw, (max-width: 1024px) 44vw, 23vw"
          className="absolute inset-0 object-cover object-center"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted">
          <PlaceholderImage size={24} />
        </div>
      )}

      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Предыдущее фото"
            onClick={(e) => step(e, -1)}
            className={`${arrow} left-0`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="h-4 w-4">
              <path d="M15 5 8 12l7 7" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Следующее фото"
            onClick={(e) => step(e, 1)}
            className={`${arrow} right-0`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="h-4 w-4">
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}
