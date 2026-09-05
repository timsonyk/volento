import Image from "next/image"

import { listProducts } from "@lib/data/products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Баннер в конце главной. По замерам референса:
 *   телефон              — одна вертикальная картинка 4:5 во всю ширину;
 *   планшет и компьютер  — одна широкая картинка 16:9 во всю ширину.
 *
 * Картинки берутся из той же записи «Баннер главной страницы», но
 * третья и четвёртая по счёту:
 *   3-я — вертикальная 1080x1350 (телефон);
 *   4-я — широкая 2560x1440 (планшет и компьютер).
 * Если их не загрузили, берутся первая и вторая — то есть повторяется
 * верхний баннер: заметно, что нужны свои снимки, но дырки нет.
 */
const BANNER_HANDLE = "home-banner"
const FALLBACK = "/banner.jpg"

const ПОДПИСЬ = "Volento — классические брюки"

const ClosingBanner = async ({ countryCode }: { countryCode: string }) => {
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
    вертикальная = images[2]?.url ?? images[0]?.url ?? FALLBACK
    широкая = images[3]?.url ?? images[1]?.url
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
          src={широкая ?? вертикальная}
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
