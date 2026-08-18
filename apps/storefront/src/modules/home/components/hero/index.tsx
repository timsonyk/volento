import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Баннер во всю ширину, как на референсе. Логотип и слоган вшиты в саму
 * картинку, поэтому поверх ничего не накладываем — иначе будет двойной
 * текст. Пропорции не режем: обрезка съела бы либо надпись, либо модель.
 */
const Hero = () => {
  return (
    <section className="border-b border-rule">
      <LocalizedClientLink
        href="/store"
        aria-label="Volento — классические брюки с характером. Перейти в каталог"
        className="group block"
        data-testid="hero-banner"
      >
        <div className="relative w-full">
          <Image
            src="/banner.jpg"
            alt="Volento — классические брюки с характером"
            width={1080}
            height={450}
            priority
            sizes="100vw"
            className="h-auto w-full"
          />
        </div>
      </LocalizedClientLink>

      <div className="content-container flex flex-col items-start gap-y-5 py-10 small:flex-row small:items-center small:justify-between small:py-12">
        <p className="max-w-md text-base leading-relaxed text-muted">
          Каждая модель выпускается в нескольких ростах и своей размерной
          сетке. Выберите свой — и подшивать не придётся.
        </p>
        <LocalizedClientLink
          href="/store"
          className="label-type inline-flex items-center border border-ink px-7 py-4 text-ink transition-colors duration-300 hover:bg-ink hover:text-paper"
          data-testid="hero-catalog-link"
        >
          Смотреть каталог
        </LocalizedClientLink>
      </div>
    </section>
  )
}

export default Hero
