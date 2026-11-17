import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getRegion } from "@lib/data/regions"
import СписокИзбранного from "@modules/products/components/spisok-izbrannogo"

export const metadata: Metadata = {
  title: "Избранное | Volento",
  description: "Вещи, которые вы отложили в магазине Volento.",
  robots: { index: false },
}

export default async function Page(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params
  const region = await getRegion(countryCode)
  if (!region) {
    notFound()
  }

  return (
    <div className="content-container py-10 small:py-14">
      <h1 className="mb-8 text-[2rem] font-semibold leading-[2.75rem]">Избранное</h1>
      <СписокИзбранного region={region} countryCode={countryCode} />
    </div>
  )
}
