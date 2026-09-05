/**
 * Заголовок блока на главной и надпись на баннере — одного размера и
 * одного шрифта. По замерам референса: 32 px на телефоне, 40 px от планшета.
 * Насыщенность зависит от шрифта: у Lora и Jost начертания настоящие,
 * у Tenor Sans одно-единственное — с ним font-light ничего не меняет.
 * Стиль в одном месте, чтобы менять его везде разом.
 */
export const РАЗМЕР_ЗАГОЛОВКА =
  "font-display text-[40px] font-light leading-[1.1] xsmall:text-[52px]"

export default function SectionHeading({
  children,
}: {
  children: React.ReactNode
}) {
  return <h2 className={`${РАЗМЕР_ЗАГОЛОВКА} text-ink`}>{children}</h2>
}
