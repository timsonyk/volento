import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Хлебные крошки над карточкой товара: показывают, откуда пришли и как
 * подняться обратно. Раздел берём самый точный из привязанных к товару; если разделов нет, ведём просто в каталог.
 */
const Breadcrumbs = ({
  product,
  название,
}: {
  product: HttpTypes.StoreProduct
  название: string
}) => {
  // вещь бывает сразу в «Брюках» и в «Прямых»: ведём в более точный раздел
  const раздел =
    product.categories?.find((c) => c.parent_category_id) ??
    product.categories?.[0]

  const звенья = [
    { имя: "Главная", адрес: "/" },
    { имя: "Каталог", адрес: "/store" },
    // сначала раздел выше («Мужское»), иначе мужские «Брюки» не отличить
    // от женских
    ...(раздел?.parent_category
      ? [
          {
            имя: раздел.parent_category.name,
            адрес: `/categories/${раздел.parent_category.handle}`,
          },
        ]
      : []),
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
            className="py-1.5 text-muted transition-colors hover:text-ink"
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
