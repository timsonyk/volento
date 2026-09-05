import Image from "next/image"

import { getHomeImages } from "@lib/data/home-banner"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Баннер в конце главной. По замерам референса:
 *   телефон              — одна вертикальная картинка 4:5 во всю ширину;
 *   планшет и компьютер  — одна широкая картинка 16:9 во всю ширину.
 *
 * Картинки 3 и 4 из записи «Картинки главной страницы» (см. home-banner.ts).
 * Если их не загрузили, берутся 1 и 2 — то есть повторяется верхний
 * баннер: заметно, что нужны свои снимки, но дырки нет.
 */
const FALLBACK = "/banner.jpg"

const ПОДПИСЬ = "Volento — классические брюки"

const ClosingBanner = async ({ countryCode }: { countryCode: string }) => {
  const images = await getHomeImages(countryCode)
  const вертикальная = images[2] ?? images[0] ?? FALLBACK
  const широкая = images[3] ?? images[1] ?? вертикальная

  return (
    <section className="w-full">
      {/* Телефон: вертикальная 4:5 */}
      <LocalizedClientLink
        href="/store"
        aria-label={`${ПОДПИСЬ}. Перейти в каталог`}
        className="relative block aspect-[4/5] w-full overflow-hidden bg-mist xsmall:hidden"
      >
        <Image
          src={вертикальная}
          alt={ПОДПИСЬ}
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
      </LocalizedClientLink>

      {/* Планшет и компьютер: широкая 16:9 */}
      <LocalizedClientLink
        href="/store"
        aria-label={`${ПОДПИСЬ}. Перейти в каталог`}
        className="relative hidden aspect-video w-full overflow-hidden bg-mist xsmall:block"
      >
        <Image
          src={широкая}
          alt={ПОДПИСЬ}
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
      </LocalizedClientLink>
    </section>
  )
}

export default ClosingBanner
