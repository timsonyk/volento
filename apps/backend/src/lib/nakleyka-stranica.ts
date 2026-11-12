import { PDFDocument } from "pdf-lib"

/**
 * Наклейка одного места из общего файла.
 *
 * На отправление из нескольких мест служба отдаёт один PDF: по странице
 * на место, в том же порядке, в каком места заявлены. Складу в каждом
 * помещении нужна только своя страница.
 *
 * Страниц не столько, сколько мест, — не угадываем: возвращаем null, и
 * склад получает файл целиком (лучше лишняя наклейка, чем чужая).
 */
export async function страницаНаклейки(
  pdf: Uint8Array,
  место: number,
  мест: number
): Promise<Uint8Array | null> {
  const весь = await PDFDocument.load(pdf, { ignoreEncryption: true })

  if (весь.getPageCount() !== мест || место < 1 || место > мест) {
    return null
  }

  const один = await PDFDocument.create()
  const [страница] = await один.copyPages(весь, [место - 1])
  один.addPage(страница)

  // без сжатых объектов: так файл читают и старые драйверы принтеров наклеек
  return один.save({ useObjectStreams: false })
}
