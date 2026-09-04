import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Широкая картинка с подписью в углу. Пропорция 16:9 — по замерам
 * референса, у них нижний баннер ровно 1440x809.
 *
 * ВРЕМЕННО: снимок взят из имеющихся, он вертикальный и в широкой полосе
 * сильно обрезается. Нужна горизонтальная съёмка от 2400 px с пустым
 * местом слева внизу под подпись.
 */
const FeatureBanner = () => (
  <section id="podborka" className="relative w-full">
    <div className="relative aspect-[16/9] w-full overflow-hidden bg-mist">
      <Image
        src="/hero.webp"
        alt="Классические брюки Volento"
        fill
        sizes="100vw"
        quality={85}
        className="object-cover object-center"
      />
    </div>

    <div className="absolute bottom-0 left-0 max-w-[86%] bg-paper px-6 py-6 small:max-w-md small:px-10 small:py-9">
      <h2 className="font-display text-xl leading-tight text-ink small:text-2xl">
        Классика на каждый день
      </h2>
      <LocalizedClientLink
        href="/store"
        className="label-type link-underline mt-4 inline-block text-ink"
      >
        Смотреть каталог
      </LocalizedClientLink>
    </div>
  </section>
)

export default FeatureBanner
