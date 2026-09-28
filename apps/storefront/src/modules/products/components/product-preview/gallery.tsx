"use client"

import Image from "next/image"
import { useState } from "react"

import PlaceholderImage from "@modules/common/icons/placeholder-image"

/**
 * Картинка карточки товара.
 *
 * Наводишь мышь — показывается второй снимок: на нём обычно вид сзади
 * или другой ракурс, и так товар понятнее, не открывая его. Уводишь
 * мышь — возвращается обложка.
 *
 * Стрелки листания есть только на компьютере. На телефоне наведения нет,
 * а :hover после касания залипает — стрелки выскакивали поверх карточки
 * и перехватывали нажатие вместо перехода на товар. Поэтому там их нет
 * вовсе: одно касание по карточке открывает товар.
 *
 * Клик по стрелке переход гасит: карточка целиком обёрнута в ссылку.
 */
export default function PreviewGallery({
  images,
  alt,
}: {
  images: string[]
  alt: string
}) {
  const [номер, setНомер] = useState(0)
  // Пока человек не трогал стрелки, наведение показывает второй снимок.
  // После стрелок наведение не вмешивается — иначе оно перебивало бы
  // выбранный вручную кадр.
  const [трогали, setТрогали] = useState(false)

  const естьВторой = images.length > 1

  const шаг = (событие: React.MouseEvent, куда: 1 | -1) => {
    событие.preventDefault()
    событие.stopPropagation()
    setТрогали(true)
    setНомер((n) => (n + куда + images.length) % images.length)
  }

  const навели = () => {
    if (!трогали && естьВторой) {
      setНомер(1)
    }
  }

  const увели = () => {
    setТрогали(false)
    setНомер(0)
  }

  // Группа названа (group/gallery), поэтому и условие показа должно быть
  // именованным: group-hover:… к ней не относится, и стрелки оставались
  // прозрачными — доехать до них можно было только клавиатурой.
  const стрелка =
    "absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center bg-paper/90 text-ink opacity-0 transition-opacity duration-200 xsmall:flex group-hover/gallery:opacity-100 focus-visible:opacity-100"

  const слой = "absolute inset-0 object-cover object-center"
  const общие = {
    alt,
    fill: true,
    quality: 80,
    draggable: false,
    sizes: "(max-width: 576px) 68vw, (max-width: 1024px) 44vw, 23vw",
  } as const

  return (
    <div
      className="group/gallery relative aspect-[2/3] w-full overflow-hidden bg-mist"
      onMouseEnter={навели}
      onMouseLeave={увели}
    >
      {images.length ? (
        <>
          {/* Обложка лежит снизу и видна всегда: пока второй снимок
              грузится, на её месте не зияет пустота. */}
          <Image {...общие} src={images[0]} className={слой} />

          {/* Верхний слой — текущий снимок. На обложке он невидим, и
              тогда это та же картинка: лишнего запроса не будет. */}
          {естьВторой && (
            <Image
              {...общие}
              src={images[номер]}
              className={`${слой} transition-opacity duration-300 ${
                номер === 0 ? "opacity-0" : "opacity-100"
              }`}
            />
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted">
          <PlaceholderImage size={24} />
        </div>
      )}

      {естьВторой && (
        <>
          <button
            type="button"
            aria-label="Предыдущее фото"
            onClick={(e) => шаг(e, -1)}
            className={`${стрелка} left-0`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="h-4 w-4">
              <path d="M15 5 8 12l7 7" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Следующее фото"
            onClick={(e) => шаг(e, 1)}
            className={`${стрелка} right-0`}
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
