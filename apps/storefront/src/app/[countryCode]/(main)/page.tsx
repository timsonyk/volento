import { Metadata } from "next"

import CategoryTiles from "@modules/home/components/category-tiles"
import ClosingBanner from "@modules/home/components/closing-banner"
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
      {/* Новинки — тоже без появления: их край виден под баннером сразу
          (баннер ниже экрана), а с появлением там была белая полоса,
          пока не начнёшь листать */}
      <LatestProducts region={region} countryCode={countryCode} />
      <Reveal>
        <CategoryTiles region={region} countryCode={countryCode} />
      </Reveal>
      {/* Блок «квадратный баннер и карточки справа» убран: у референса
          он показывает коллекцию, а коллекций у нас нет — непонятно, что
          в нём держать (встреча 23 октября). Компонент feature-block
          оставлен — вернуть одной строкой. */}
      <Reveal>
        <ClosingBanner countryCode={countryCode} />
      </Reveal>
    </>
  )
}
