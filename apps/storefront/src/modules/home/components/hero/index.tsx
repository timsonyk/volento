import Image from "next/image"

import { getHomeImages } from "@lib/data/home-banner"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Первый экран главной. Раскладка по замерам референса:
 *   телефон              — одна вертикальная картинка 4:5 во всю ширину;
 *   планшет и компьютер  — одна широкая картинка 8:5 во всю ширину.
 *
 * Картинки 1 и 2 из записи «Картинки главной страницы» (см. home-banner.ts).
 * Если второй нет, на компьютере показывается первая, обрезанная до 8:5.
 * Обе вписываются с обрезкой по центру — значимое держать в середине кадра.
 */
const FALLBACK = "/banner.jpg"

const ПОДПИСЬ = "Volento — классические брюки с характером"

const Hero = async ({ countryCode }: { countryCode: string }) => {
  const images = await getHomeImages(countryCode)
  const вертикальная = images[0] ?? FALLBACK
  const широкая = images[1] ?? вертикальная

  return (
    <section className="w-full">
      {/* Телефон: вертикальная 4:5 */}
      <LocalizedClientLink
        href="/store"
        aria-label={`${ПОДПИСЬ}. Перейти в каталог`}
        className="relative block aspect-[4/5] w-full overflow-hidden bg-mist xsmall:hidden"
        data-testid="hero-banner"
      >
        <Image
          src={вертикальная}
          alt={ПОДПИСЬ}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </LocalizedClientLink>

      {/* Планшет и компьютер: широкая 8:5 */}
      <LocalizedClientLink
        href="/store"
        aria-label={`${ПОДПИСЬ}. Перейти в каталог`}
        className="relative hidden aspect-[8/5] w-full overflow-hidden bg-mist xsmall:block"
      >
        <Image
          src={широкая}
          alt={ПОДПИСЬ}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </LocalizedClientLink>
    </section>
  )
}

export default Hero
