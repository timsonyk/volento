import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Широкая картинка без надписей. Пропорции по замерам референса:
 * на телефоне квадрат, от планшета 16:9 (у них 1440x809).
 *
 * ВРЕМЕННО: снимок взят из имеющихся, он вертикальный и в широкой полосе
 * сильно обрезается. Нужна горизонтальная съёмка от 2400 px.
 */
const FeatureBanner = () => (
  <section id="podborka" className="w-full">
    <LocalizedClientLink href="/store" className="block">
      {/* На телефоне квадрат, от планшета 16:9 — по замерам референса.
          Надписи поверх нет: у них картинка идёт чистой. */}
      <div className="relative aspect-square w-full overflow-hidden bg-mist xsmall:aspect-[16/9]">
        <Image
          src="/hero.webp"
          alt="Классические брюки Volento"
          fill
          sizes="100vw"
          quality={85}
          className="object-cover object-center"
        />
      </div>
    </LocalizedClientLink>
  </section>
)

export default FeatureBanner
