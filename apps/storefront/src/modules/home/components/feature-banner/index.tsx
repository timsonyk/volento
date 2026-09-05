import Image from "next/image"

import { getHomeImages } from "@lib/data/home-banner"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Широкая картинка без надписей между категориями и товарами.
 * Пропорции по замерам референса: на телефоне квадрат, от планшета 16:9.
 *
 * Картинка 5 из записи «Картинки главной страницы» (см. home-banner.ts).
 * Пока её не загрузили — запасной файл из public.
 */
const FALLBACK = "/hero.webp"

const FeatureBanner = async ({ countryCode }: { countryCode: string }) => {
  const images = await getHomeImages(countryCode)
  const картинка = images[4] ?? FALLBACK

  return (
    <section id="podborka" className="w-full">
      <LocalizedClientLink href="/store" className="block">
        <div className="relative aspect-square w-full overflow-hidden bg-mist xsmall:aspect-[16/9]">
          <Image
            src={картинка}
            alt="Классические брюки Volento"
            fill
            sizes="100vw"
            quality={85}
            className="object-cover object-center"
          />
        </div>
      </LocalizedClientLink>
    </section>
  )
}

export default FeatureBanner
