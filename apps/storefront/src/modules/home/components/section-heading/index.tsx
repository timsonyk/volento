/**
 * Заголовок блока на главной и надпись на баннере — одного размера и
 * одного шрифта. По замерам референса: 32 px на телефоне, 40 px от планшета.
 * Шрифт фирменный, Doloman Pavljenko, у него одно начертание — Light.
 * Держим стиль в одном месте, чтобы менять его везде разом.
 */
export const РАЗМЕР_ЗАГОЛОВКА =
  "font-display text-[32px] font-light leading-[1.15] xsmall:text-[40px]"

export default function SectionHeading({
  children,
}: {
  children: React.ReactNode
}) {
  return <h2 className={`${РАЗМЕР_ЗАГОЛОВКА} text-ink`}>{children}</h2>
}
