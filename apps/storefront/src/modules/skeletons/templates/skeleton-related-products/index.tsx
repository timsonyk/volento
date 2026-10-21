import repeat from "@lib/util/repeat"
import SkeletonProductPreview from "@modules/skeletons/components/skeleton-product-preview"

const SkeletonRelatedProducts = () => {
  return (
    <div>
      <div className="mb-8 h-9 w-48 animate-pulse bg-mist" />
      <ul className="grid grid-cols-2 gap-x-2 gap-y-7 small:grid-cols-4">
        {repeat(4).map((index) => (
          <li key={index}>
            <SkeletonProductPreview />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default SkeletonRelatedProducts
