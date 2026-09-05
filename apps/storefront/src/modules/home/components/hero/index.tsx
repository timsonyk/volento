import Image from "next/image"

import { getHomeContent } from "@lib/data/home-banner"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { РАЗМЕР_ЗАГОЛОВКА } from "@modules/home/components/section-heading"

/**
 * Первый экран главной. Раскладка по замерам референса:
 *   телефон              — одна вертикальная картинка 4:5 во всю ширину;
 *   планшет и компьютер  — две вертикальные 4:5 рядом, по половине ширины.
 *
 * Картинки 1 и 2 из записи «Картинки главной страницы»; если второй нет,
 * справа повторяется первая. Обе обрезаются по центру — значимое держать
 * в середине кадра.
 *
 * Надпись поверх берётся оттуда же из метаданных, редактируется в админке.
 * Если её не задали, баннер показывается чистым.
 */
const FALLBACK = "/banner.jpg"

const ПОДПИСЬ = "Volento — классические брюки с характером"

const Hero = async ({ countryCode }: { countryCode: string }) => {
  const { картинки, надпись, ссылкаТекст, ссылкаАдрес } =
    await getHomeContent(countryCode)
  const слева = картинки[0] ?? FALLBACK
  const справа = картинки[1] ?? слева

  return (
    <section className="relative w-full">
      {/* Телефон: одна вертикальная 4:5 */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-mist xsmall:hidden">
        <Image
          src={слева}
          alt={ПОДПИСЬ}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* Планшет и компьютер: две вертикальные 4:5 рядом */}
      <div className="hidden w-full grid-cols-2 xsmall:grid">
        {[слева, справа].map((src, n) => (
          <div
            key={n}
            className="relative aspect-[4/5] w-full overflow-hidden bg-mist"
          >
            <Image
              src={src}
              alt={ПОДПИСЬ}
              fill
              priority
              sizes="50vw"
              className="object-cover object-center"
            />
          </div>
        ))}
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
