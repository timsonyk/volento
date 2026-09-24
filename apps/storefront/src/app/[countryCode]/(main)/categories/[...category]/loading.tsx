import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"

/**
 * Показывается сразу при переходе в раздел, пока страница готовится.
 *
 * Разметка повторяет настоящую: название по центру, ряд подразделов,
 * сортировка справа, сетка. Тогда при появлении страницы ничего не
 * прыгает — заглушки стоят там же, где встанет содержимое.
 */
export default function Loading() {
  return (
    <div className="content-container pb-12 pt-6">
      <div className="mb-4 flex justify-center">
        <div className="h-5 w-32 animate-pulse bg-mist" />
      </div>
      <div className="mb-6 flex justify-center gap-x-7">
        <div className="h-4 w-20 animate-pulse bg-mist" />
        <div className="h-4 w-24 animate-pulse bg-mist" />
        <div className="h-4 w-20 animate-pulse bg-mist" />
      </div>
      <div className="mb-6 flex justify-end">
        <div className="h-5 w-64 animate-pulse bg-mist" />
      </div>
      <SkeletonProductGrid numberOfProducts={12} />
    </div>
  )
}
