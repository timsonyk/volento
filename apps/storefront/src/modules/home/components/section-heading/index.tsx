/**
 * Заголовок блока на главной и надпись на баннере — одного размера и
 * одного шрифта. По замерам референса: 32 px на телефоне, 40 px от планшета.
 * Шрифт фирменный, Doloman Pavljenko. Начертание у него одно, Light,
 * поэтому насыщенность добавляем обводкой в цвет текста: в отличие от
 * font-bold, который браузер дорисовывает грубым скачком, обводка даёт
 * любую промежуточную жирность. Стиль в одном месте, чтобы менять разом.
 */
export const РАЗМЕР_ЗАГОЛОВКА =
  "font-display text-[40px] leading-[1.1] [-webkit-text-stroke:0.6px_currentColor] xsmall:text-[52px]"

export default function SectionHeading({
  children,
}: {
  children: React.ReactNode
}) {
  return <h2 className={`${РАЗМЕР_ЗАГОЛОВКА} text-ink`}>{children}</h2>
}
