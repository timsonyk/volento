import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Мера — вертикальная линия с засечками, как на портновской выкройке.
 * Здесь она без цифр: конкретные значения роста появляются на карточке
 * товара, где за ними стоят настоящие данные.
 */
const Measure = () => (
  <div aria-hidden className="flex h-full flex-col justify-between py-2">
    {Array.from({ length: 9 }).map((_, i) => (
      <span
        key={i}
        className={`block h-px bg-ink ${
          i % 4 === 0 ? "w-6 opacity-100" : "w-3 opacity-40"
        }`}
      />
    ))}
  </div>
)

const Hero = () => {
  return (
    <section className="border-b border-rule">
      <div className="content-container grid grid-cols-1 gap-y-10 py-14 small:grid-cols-12 small:gap-x-10 small:py-24">
        {/* левая колонка: высказывание */}
        <div className="flex flex-col justify-center small:col-span-6 small:pr-6">
          <span className="label-type text-muted">Классические брюки</span>

          <h1 className="mt-6 font-display text-[2.5rem] leading-[1.08] text-ink small:text-[3.75rem]">
            Брюки,
            <br />
            подобранные
            <br />
            по росту
          </h1>

          <p className="mt-7 max-w-sm text-base leading-relaxed text-muted">
            Каждая модель выпускается в нескольких ростах и своей размерной
            сетке. Выберите свой — и подшивать не придётся.
          </p>

          <div className="mt-10">
            <LocalizedClientLink
              href="/store"
              className="label-type inline-flex items-center gap-x-3 border border-ink px-7 py-4 text-ink transition-colors duration-300 hover:bg-ink hover:text-paper"
              data-testid="hero-catalog-link"
            >
              Смотреть каталог
            </LocalizedClientLink>
          </div>
        </div>

        {/* правая колонка: мера и фотография */}
        <div className="flex gap-x-5 small:col-span-6">
          <div className="hidden small:block">
            <Measure />
          </div>
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-mist">
            <Image
              src="/hero.webp"
              alt="Женские классические брюки Volento"
              fill
              priority
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover object-center"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
