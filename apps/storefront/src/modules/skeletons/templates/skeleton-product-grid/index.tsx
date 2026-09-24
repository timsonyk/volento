import repeat from "@lib/util/repeat"
import SkeletonProductPreview from "@modules/skeletons/components/skeleton-product-preview"

const SkeletonProductGrid = ({
  numberOfProducts = 8,
}: {
  numberOfProducts?: number
}) => {
  return (
    <ul
      // промежутки те же, что у настоящей сетки: иначе при появлении
      // товаров вся страница дёргалась
      className="grid w-full grid-cols-2 gap-x-2 gap-y-7 small:grid-cols-3 medium:grid-cols-4"
      data-testid="products-list-loader"
    >
      {repeat(numberOfProducts).map((index) => (
        <li key={index}>
          <SkeletonProductPreview />
        </li>
      ))}
    </ul>
  )
}

export default SkeletonProductGrid
