import Image from "next/image"

import { getHomeContent } from "@lib/data/home-banner"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Баннер в конце главной. По замерам референса:
 *   телефон              — одна вертикальная картинка 4:5 во всю ширину;
 *   планшет и компьютер  — одна широкая картинка 16:9 во всю ширину.
 *
 * Картинки по ключам «низ_телефон» и «низ_компьютер». Если их не
 * загрузили, берутся верхние — то есть повторяется первый баннер:
 * заметно, что нужны свои снимки, но дырки нет.
 */
const FALLBACK = "/banner.jpg"

const ПОДПИСЬ = "Volento — классические брюки"

const ClosingBanner = async ({ countryCode }: { countryCode: string }) => {
  const { картинка } = await getHomeContent(countryCode)
  const вертикальная =
    картинка("низ_телефон") ?? картинка("верх_телефон") ?? FALLBACK
  const широкая =
    картинка("низ_компьютер") ?? картинка("верх_компьютер") ?? вертикальная

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
