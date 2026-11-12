/**
 * Отметка тестового заказа склада и его поддельная наклейка.
 *
 * Отдельным файлом без процессов Medusa: его подключает и провайдер
 * доставки (modules/dostavka-apiship), а тот грузится раньше всего
 * остального. Сами тестовые заказы — lib/sklad-test.ts.
 */
export const ТЕСТ = "sklad_test"

export const этоТест = (з: any) => Boolean((з?.metadata ?? {})[ТЕСТ])

/**
 * Поддельная наклейка 75×120 мм — PDF без шрифтов кириллицы, поэтому
 * латиницей. Склад проверит на ней печать и размер. Мест несколько —
 * страниц столько же, как у настоящей: по наклейке на место.
 */
export function тестоваяНаклейка(номер: string, мест = 1): string {
  const всего = Math.max(1, Math.trunc(мест) || 1)
  const страница = (место: number) => {
    const строки = [
      "TEST LABEL",
      `ORDER ${номер}`,
      ...(всего > 1 ? [`PLACE ${место} OF ${всего}`] : []),
      "NOT FOR SHIPPING",
    ]
    return строки
      .map((с, и) => `BT /F1 ${и ? 14 : 22} Tf 20 ${280 - и * 40} Td (${с}) Tj ET`)
      .join("\n")
  }

  // 1 — каталог, 2 — список страниц, 3 — шрифт, дальше по два на страницу
  const страницы = Array.from({ length: всего }, (_, и) => 4 + и * 2)
  const объекты = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${страницы.map((н) => `${н} 0 R`).join(" ")}] /Count ${всего} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  страницы.forEach((н, и) => {
    const текст = страница(и + 1)
    объекты.push(
      // 75×120 мм в пунктах
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 212.6 340.2] /Contents ${н + 1} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
      `<< /Length ${текст.length} >>\nstream\n${текст}\nendstream`
    )
  })

  let pdf = "%PDF-1.4\n"
  const смещения: number[] = []
  объекты.forEach((о, и) => {
    смещения.push(pdf.length)
    pdf += `${и + 1} 0 obj\n${о}\nendobj\n`
  })
  const начало = pdf.length
  pdf += `xref\n0 ${объекты.length + 1}\n0000000000 65535 f \n`
  pdf += смещения.map((с) => `${String(с).padStart(10, "0")} 00000 n \n`).join("")
  pdf += `trailer\n<< /Size ${объекты.length + 1} /Root 1 0 R >>\nstartxref\n${начало}\n%%EOF\n`

  return `data:application/pdf;base64,${Buffer.from(pdf, "latin1").toString("base64")}`
}
