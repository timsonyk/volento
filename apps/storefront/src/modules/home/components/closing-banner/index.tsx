import Image from "next/image"

import { listProducts } from "@lib/data/products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Баннер в конце главной. Геометрия та же, что у первого экрана:
 * на телефоне одна вертикальная 4:5, на компьютере две по половине
 * ширины — слева 4:5, справа 10:7.
 *
 * Картинки берутся из той же записи «Баннер главной страницы», но
 * третья и четвёртая по счёту:
 *   3-я — вертикальная 1080x1350;
 *   4-я — горизонтальная 2560x1792.
 * Если их не загрузили, показываются первые две, то есть повторяется
 * верхний баннер — заметно, что нужны свои снимки, но дырки нет.
 */
const BANNER_HANDLE = "home-banner"
const FALLBACK = "/banner.jpg"

const ПОДПИСЬ = "Volento — классические брюки"

const ClosingBanner = async ({ countryCode }: { countryCode: string }) => {
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
    вертикальная = images[2]?.url ?? images[0]?.url ?? FALLBACK
    горизонтальная = images[3]?.url ?? images[1]?.url
  } catch {
    // баннер не критичен: при недоступном бэкенде показываем запасной файл
  }

  const справа = горизонтальная ?? вертикальная

  return (
    <section className="w-full">
      {/* Телефон: одна вертикальная 4:5 */}
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

      {/* Компьютер и планшет: две по половине ширины, по верху */}
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
            sizes="50vw"
            className="object-cover object-center"
          />
        </LocalizedClientLink>
      </div>
    </section>
  )
}

export default ClosingBanner
