import Image from "next/image"

import { listProducts } from "@lib/data/products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Первый экран главной. Картинки берутся из админки: там заведён служебный
 * товар с адресом home-banner, его изображения и есть баннер.
 *
 * Раскладка по замерам референса:
 *   телефон    — одна вертикальная картинка 4:5;
 *   компьютер  — две в ряд по половине ширины: слева вертикальная 4:5,
 *                справа горизонтальная 10:7, выровненные по верху.
 *
 * Порядок картинок в админке:
 *   первая  — вертикальная 1080x1350 (телефон и левая половина);
 *   вторая  — горизонтальная 2560x1792 (правая половина на компьютере).
 *
 * Обе вписываются с обрезкой по центру, поэтому значимое держать в
 * середине кадра — края срезаются.
 */
const BANNER_HANDLE = "home-banner"
const FALLBACK = "/banner.jpg"

const ПОДПИСЬ = "Volento — классические брюки с характером"

const Hero = async ({ countryCode }: { countryCode: string }) => {
  let вертикальная = FALLBACK
  let горизонтальная: string | undefined

  try {
    const {
      response: { products },
    } = await listProducts({
      countryCode,
      queryParams: { handle: BANNER_HANDLE, limit: 1 },
    })

    const images = products[0]?.images ?? []
    if (images[0]?.url) {
      вертикальная = images[0].url
    }
    if (images[1]?.url) {
      горизонтальная = images[1].url
    }
  } catch {
    // баннер не критичен: при недоступном бэкенде показываем запасной файл
  }

  // если вторая картинка не загружена, справа показываем ту же первую —
  // лучше повтор, чем дыра в половину экрана
  const справа = горизонтальная ?? вертикальная

  return (
    <section className="w-full">
      {/* Телефон: одна вертикальная 4:5 */}
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

      {/* Компьютер и планшет: две картинки по половине ширины, по верху */}
      <div className="hidden w-full items-start xsmall:grid xsmall:grid-cols-2">
        <LocalizedClientLink
          href="/store"
          aria-label={`${ПОДПИСЬ}. Перейти в каталог`}
          className="relative block aspect-[4/5] w-full overflow-hidden bg-mist"
        >
          <Image
            src={вертикальная}
            alt={ПОДПИСЬ}
            fill
            priority
            sizes="50vw"
            className="object-cover object-center"
          />
        </LocalizedClientLink>

        <LocalizedClientLink
          href="/store"
          aria-label={`${ПОДПИСЬ}. Перейти в каталог`}
          className="relative block aspect-[10/7] w-full overflow-hidden bg-mist"
        >
          <Image
            src={справа}
            alt={ПОДПИСЬ}
            fill
            priority
            sizes="50vw"
            className="object-cover object-center"
          />
        </LocalizedClientLink>
      </div>
    </section>
  )
}

export default Hero
