/**
 * Заголовки блоков главной и надпись на баннере. Шрифт и насыщенность
 * общие, размеры разные: заголовок над лентой должен быть скромным, а
 * надпись поверх баннера — крупной, иначе теряется на фотографии.
 *
 * Насыщенность зависит от шрифта: у Lora и Jost начертания настоящие,
 * у Tenor Sans одно-единственное — с ним font-light ничего не меняет.
 * Размеры держим здесь, чтобы менять их везде разом.
 */
const ОБЩЕЕ = "font-display font-light leading-[1.15]"

export const РАЗМЕР_ЗАГОЛОВКА = `${ОБЩЕЕ} text-[28px] xsmall:text-[36px]`

export const РАЗМЕР_НАДПИСИ_БАННЕРА = `${ОБЩЕЕ} text-[36px] xsmall:text-[48px]`

export default function SectionHeading({
  children,
}: {
  children: React.ReactNode
}) {
  return <h2 className={`${РАЗМЕР_ЗАГОЛОВКА} text-ink`}>{children}</h2>
}
