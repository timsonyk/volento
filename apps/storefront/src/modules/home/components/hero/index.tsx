import Image from "next/image"

import { listProducts } from "@lib/data/products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Первый экран главной. Картинки берутся из админки: там заведён служебный
 * товар с адресом home-banner, его изображения и есть баннер.
 *
 * Раскладка по замерам референса:
 *   телефон              — одна вертикальная картинка 4:5 во всю ширину;
 *   планшет и компьютер  — одна широкая картинка 8:5 во всю ширину.
 *
 * Порядок картинок в админке:
 *   первая  — вертикальная 1080x1350 (телефон);
 *   вторая  — широкая 2560x1600 (планшет и компьютер).
 * Если второй нет, на компьютере показывается первая, обрезанная до 8:5.
 *
 * Обе вписываются с обрезкой по центру, поэтому значимое держать в
 * середине кадра — края срезаются.
 */
const BANNER_HANDLE = "home-banner"
const FALLBACK = "/banner.jpg"

const ПОДПИСЬ = "Volento — классические брюки с характером"

const Hero = async ({ countryCode }: { countryCode: string }) => {
  let вертикальная = FALLBACK
  let широкая: string | undefined

  try {
    const {
      response: { products },
    } = await listProducts({
      countryCode,
      queryParams: { handle: BANNER_HANDLE, limit: 1 },
    })

    const images = products[0]?.images ?? []
    вертикальная = images[0]?.url ?? FALLBACK
    широкая = images[1]?.url
  } catch {
    // баннер не критичен: при недоступном бэкенде показываем запасной файл
  }

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
          src={широкая ?? вертикальная}
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
