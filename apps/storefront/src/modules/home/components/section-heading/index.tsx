/**
 * Заголовок блока на главной и надпись на баннере — одного размера и
 * одного шрифта: 28 px на телефоне, 36 px от планшета.
 * Насыщенность зависит от шрифта: у Lora и Jost начертания настоящие,
 * у Tenor Sans одно-единственное — с ним font-light ничего не меняет.
 * Стиль в одном месте, чтобы менять его везде разом.
 */
export const РАЗМЕР_ЗАГОЛОВКА =
  "font-display text-[28px] font-light leading-[1.15] xsmall:text-[36px]"

export default function SectionHeading({
  children,
}: {
  children: React.ReactNode
}) {
  return <h2 className={`${РАЗМЕР_ЗАГОЛОВКА} text-ink`}>{children}</h2>
}
