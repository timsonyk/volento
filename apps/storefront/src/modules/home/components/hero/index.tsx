import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Баннер во всю ширину. Логотип и слоган вшиты в саму картинку, поэтому
 * поверх ничего не накладываем. Пропорции не режем: обрезка съела бы
 * либо надпись, либо модель.
 */
const Hero = () => {
  return (
    <section className="border-b border-rule">
      <LocalizedClientLink
        href="/store"
        aria-label="Volento — классические брюки с характером. Перейти в каталог"
        className="block"
        data-testid="hero-banner"
      >
        <Image
          src="/banner.jpg"
          alt="Volento — классические брюки с характером"
          width={1080}
          height={450}
          priority
          sizes="100vw"
          className="h-auto w-full"
        />
      </LocalizedClientLink>
    </section>
  )
}

export default Hero
