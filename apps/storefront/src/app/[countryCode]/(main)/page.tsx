import { Metadata } from "next"

import CategoryTiles from "@modules/home/components/category-tiles"
import Editorial from "@modules/home/components/editorial"
import Hero from "@modules/home/components/hero"
import LatestProducts from "@modules/home/components/latest-products"
import { getRegion } from "@lib/data/regions"

export const metadata: Metadata = {
  title: "Volento — женские классические брюки",
  description:
    "Интернет-магазин Volento: женские классические брюки для работы и на каждый день.",
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params
  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  return (
    <>
      <Hero />
      <Editorial />
      <LatestProducts region={region} />
      <CategoryTiles region={region} />
    </>
  )
}
