import Image from "next/image"

import { listProducts } from "@lib/data/products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Баннер главной. Картинка берётся из админки: там заведён служебный
 * товар с адресом home-banner, его изображения и есть баннер.
 * Первая картинка — для компьютера, вторая (если есть) — для телефона.
 *
 * Если товара или картинок нет, показываем файл из репозитория, чтобы
 * главная не осталась пустой.
 */
const BANNER_HANDLE = "home-banner"
const FALLBACK = "/banner.jpg"

// высота шапки: промо-полоса 26 px + навигация 51.2 / 76.8 px
const HERO_HEIGHT = "h-[calc(100svh-77px)] small:h-[calc(100svh-103px)]"

const Hero = async ({ countryCode }: { countryCode: string }) => {
  let desktop = FALLBACK
  let mobile: string | undefined

  try {
    const {
      response: { products },
    } = await listProducts({
      countryCode,
      queryParams: { handle: BANNER_HANDLE, limit: 1 },
    })

    const images = products[0]?.images ?? []
    if (images[0]?.url) {
      desktop = images[0].url
    }
    if (images[1]?.url) {
      mobile = images[1].url
    }
  } catch {
    // баннер не критичен: при недоступном бэкенде показываем запасной файл
  }

  return (
    <section className={`relative w-full overflow-hidden ${HERO_HEIGHT}`}>
      <LocalizedClientLink
        href="/store"
        aria-label="Volento — классические брюки с характером. Перейти в каталог"
        className="block h-full w-full"
        data-testid="hero-banner"
      >
        <Image
          src={mobile ?? desktop}
          alt="Volento — классические брюки с характером"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center small:hidden"
        />
        <Image
          src={desktop}
          alt="Volento — классические брюки с характером"
          fill
          priority
          sizes="100vw"
          className="hidden object-cover object-center small:block"
        />
      </LocalizedClientLink>
    </section>
  )
}

export default Hero
