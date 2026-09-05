/**
 * Заголовок блока на главной и надпись на баннере — одного размера.
 * По замерам референса: 32 px на телефоне, 40 px от планшета.
 * Размер держим в одном месте, чтобы менять его вместе со шрифтом.
 */
export const РАЗМЕР_ЗАГОЛОВКА = "text-[32px] leading-[1.15] xsmall:text-[40px]"

export default function SectionHeading({
  children,
}: {
  children: React.ReactNode
}) {
  return <h2 className={`${РАЗМЕР_ЗАГОЛОВКА} text-ink`}>{children}</h2>
}
