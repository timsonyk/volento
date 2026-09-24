"use client"

import { useState } from "react"

/**
 * Описание товара, свёрнутое до трёх строк.
 *
 * Тексты приходят с Ozon целыми абзацами на полэкрана и отодвигают
 * вниз то, ради чего человек пришёл: цену, размер, рост и цвет.
 * Показываем начало, остальное — по кнопке.
 *
 * Длину считаем по знакам, а не по высоте: измерять высоту можно только
 * после отрисовки, и кнопка успевала мигнуть.
 */
const ПОРОГ = 260

const ProductDescription = ({ text }: { text: string }) => {
  const [развёрнуто, setРазвёрнуто] = useState(false)
  const длинное = text.length > ПОРОГ

  return (
    <div className="mt-6">
      <p
        className={
          длинное && !развёрнуто
            ? "line-clamp-3 whitespace-pre-line text-base leading-relaxed text-ink"
            : "whitespace-pre-line text-base leading-relaxed text-ink"
        }
        data-testid="product-description"
      >
        {text}
      </p>

      {длинное && (
        <button
          type="button"
          onClick={() => setРазвёрнуто((б) => !б)}
          aria-expanded={развёрнуто}
          className="mt-2 py-2 text-sm text-muted underline underline-offset-[5px] transition-colors hover:text-ink"
          data-testid="description-toggle"
        >
          {развёрнуто ? "Свернуть" : "Читать далее"}
        </button>
      )}
    </div>
  )
}

export default ProductDescription
