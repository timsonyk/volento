import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"

/**
 * Показывается сразу при переходе в каталог, пока страница готовится.
 *
 * Без этого файла Next ничего не рисует до готовности ответа: человек
 * нажимает «Брюки», несколько секунд видит прежнюю страницу и решает,
 * что нажатие не сработало.
 */
export default function Loading() {
  return (
    <div className="content-container pb-12 pt-6">
      <div className="mb-4 h-5 w-28 animate-pulse bg-mist" />
      <div className="mb-6 flex justify-end">
        <div className="h-5 w-64 animate-pulse bg-mist" />
      </div>
      <SkeletonProductGrid numberOfProducts={12} />
    </div>
  )
}
