import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Хлебные крошки над карточкой товара: показывают, откуда пришли и как
 * подняться обратно. Раздел берём первый из привязанных к товару — их
 * обычно один; если разделов нет, ведём просто в каталог.
 */
const Breadcrumbs = ({
  product,
  название,
}: {
  product: HttpTypes.StoreProduct
  название: string
}) => {
  const раздел = product.categories?.[0]

  const звенья = [
    { имя: "Главная", адрес: "/" },
    { имя: "Каталог", адрес: "/store" },
    ...(раздел
      ? [{ имя: раздел.name, адрес: `/categories/${раздел.handle}` }]
      : []),
  ]

  return (
    <nav aria-label="Вы здесь" className="flex flex-wrap items-center gap-x-2 text-sm">
      {звенья.map((з) => (
        <span key={з.адрес} className="flex items-center gap-x-2">
          <LocalizedClientLink
            href={з.адрес}
            className="text-muted transition-colors hover:text-ink"
          >
            {з.имя}
          </LocalizedClientLink>
          <span aria-hidden className="text-rule">
            ›
          </span>
        </span>
      ))}
      <span className="text-ink">{название}</span>
    </nav>
  )
}

export default Breadcrumbs
