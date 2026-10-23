import { getImageProps } from "next/image"

import { getHomeContent } from "@lib/data/home-banner"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { РАЗМЕР_ЗАГОЛОВКА } from "@modules/home/components/section-heading"

/**
 * Первый экран главной — одна картинка во всю ширину:
 *   телефон              — вертикальная 4:5;
 *   планшет и компьютер  — широкая 8:5.
 *
 * Картинки берутся по ключам «верх_телефон» и «верх_компьютер»; если
 * второй нет, на компьютере обрезается первая. Обе вписываются с обрезкой
 * по центру — значимое держать в середине кадра.
 *
 * На компьютере баннер ниже экрана (встреча 23 октября): под ним
 * выглядывает лента «Новинки» — видно, что дальше есть товары. Кадр
 * сдвинут чуть вниз от середины: люди на снимке стоят ниже центра, а
 * должны оказаться посередине баннера.
 *
 * Надпись поверх берётся оттуда же из метаданных, редактируется в админке.
 * Если её не задали, баннер показывается чистым.
 */
const FALLBACK = "/banner.jpg"

const ПОДПИСЬ = "Volento — классические брюки с характером"

const Hero = async ({ countryCode }: { countryCode: string }) => {
  const { картинка, надпись, ссылкаТекст, ссылкаАдрес } =
    await getHomeContent(countryCode)
  const вертикальная = картинка("верх_телефон") ?? FALLBACK
  const широкая = картинка("верх_компьютер") ?? вертикальная

  // Одна картинка с двумя источниками: браузер сам берёт нужный по ширине
  // окна. Раньше было две <Image priority>, одна из них скрыта — и обе
  // грузились первыми: телефон тянул широкий баннер на 1,7 МБ впустую.
  const общие = { alt: ПОДПИСЬ, fill: true, priority: true, sizes: "100vw" }
  const {
    props: { srcSet: широкийНабор },
  } = getImageProps({ ...общие, src: широкая })
  const { props: телефон } = getImageProps({ ...общие, src: вертикальная })

  return (
    <section className="relative w-full">
      {/* Телефон: вертикальная 4:5; планшет и компьютер: широкая 8:5 */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-mist xsmall:aspect-[8/5] small:aspect-auto small:h-[calc(100vh-14rem)] small:min-h-[420px]">
        <picture>
          <source media="(min-width: 512px)" srcSet={широкийНабор} sizes="100vw" />
          <img {...телефон} alt={ПОДПИСЬ} className="object-cover object-center small:object-[50%_74%]" />
        </picture>
      </div>

      {/* Надпись поверх — по замерам референса белая, слева внизу */}
      {(надпись || ссылкаТекст) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-8 xsmall:px-[30px] xsmall:pb-12 small:px-[50px]">
          {надпись && (
            <p
              className={`${РАЗМЕР_ЗАГОЛОВКА} max-w-[18ch] text-paper drop-shadow-sm`}
            >
              {надпись}
            </p>
          )}
          {ссылкаТекст && (
            <LocalizedClientLink
              href={ссылкаАдрес}
              className="pointer-events-auto mt-3 inline-block border-b border-paper pb-1 text-sm tracking-[0.12em] text-paper"
            >
              {ссылкаТекст}
            </LocalizedClientLink>
          )}
        </div>
      )}
    </section>
  )
}

export default Hero
