import { Metadata } from "next"

import CategoryTiles from "@modules/home/components/category-tiles"
import ClosingBanner from "@modules/home/components/closing-banner"
import FeatureBlock from "@modules/home/components/feature-block"
import Hero from "@modules/home/components/hero"
import LatestProducts from "@modules/home/components/latest-products"
import Reveal from "@modules/common/components/reveal"
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
      {/* первый экран без появления: он виден сразу, анимировать нечего */}
      <Hero countryCode={countryCode} />
      <Reveal>
        <LatestProducts region={region} countryCode={countryCode} />
      </Reveal>
      <Reveal>
        <CategoryTiles region={region} countryCode={countryCode} />
      </Reveal>
      <Reveal>
        <FeatureBlock region={region} countryCode={countryCode} />
      </Reveal>
      <Reveal>
        <ClosingBanner countryCode={countryCode} />
      </Reveal>
    </>
  )
}
