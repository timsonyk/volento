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
 *
 * Картинка растягивается на весь экран и обрезается по краям, поэтому
 * формат баннера важен: 2560x1440 для компьютера, 1080x1920 для телефона.
 * Значимое держать в середине — края срезаются на узких экранах.
 */
const BANNER_HANDLE = "home-banner"
const FALLBACK = "/banner.jpg"

// высота шапки, которую вычитаем из экрана:
// промо-полоса 26 px + навигация 51.2 px (телефон) / 76.8 px (компьютер)

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

  // На телефоне держим собственные пропорции баннера (9:16): экран за вычетом
  // шапки чуть уже, и при растягивании на всю высоту срезались бы бока
  // вместе с логотипом.
  const hasMobileBanner = Boolean(mobile)

  return (
    <>
      {/* Телефон */}
      {hasMobileBanner ? (
        <section className="relative aspect-[9/16] w-full overflow-hidden bg-mist small:hidden">
          <LocalizedClientLink
            href="/store"
            aria-label="Volento — классические брюки с характером. Перейти в каталог"
            className="block h-full w-full"
            data-testid="hero-banner"
          >
            <Image
              src={mobile!}
              alt="Volento — классические брюки с характером"
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
          </LocalizedClientLink>
        </section>
      ) : (
        // Пока для телефона не загружен свой баннер, показываем картинку
        // целиком: широкий баннер во весь экран обрезается до фрагмента.
        <section className="w-full bg-mist small:hidden">
          <LocalizedClientLink
            href="/store"
            aria-label="Volento — классические брюки с характером. Перейти в каталог"
            className="block"
            data-testid="hero-banner"
          >
            <Image
              src={desktop}
              alt="Volento — классические брюки с характером"
              width={1080}
              height={450}
              priority
              sizes="100vw"
              className="h-auto w-full"
            />
          </LocalizedClientLink>
        </section>
      )}

      {/* Компьютер */}
      <section className="relative hidden w-full overflow-hidden bg-mist h-[calc(100svh-103px)] small:block">
        <LocalizedClientLink
          href="/store"
          aria-label="Volento — классические брюки с характером. Перейти в каталог"
          className="block h-full w-full"
        >
          <Image
            src={desktop}
            alt="Volento — классические брюки с характером"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        </LocalizedClientLink>
      </section>
    </>
  )
}

export default Hero
