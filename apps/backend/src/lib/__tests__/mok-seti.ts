/**
 * Подмена fetch для тестов: ни один запрос не уходит в сеть. Каждый
 * адрес отвечает тем, что задал тест; незнакомый адрес — ошибка теста.
 */
export type Ответ = { status?: number; body?: unknown } | Error

export type Обработчик = (адрес: string, тело: any) => Ответ

export function подменитьСеть(обработчик: Обработчик) {
  const вызовы: { адрес: string; тело: any; заголовки: Record<string, string> }[] = []

  const мок = jest.spyOn(global, "fetch").mockImplementation(async (вход: any, опции: any = {}) => {
    const адрес = String(вход)
    const тело = опции.body ? JSON.parse(опции.body) : undefined
    вызовы.push({ адрес, тело, заголовки: опции.headers ?? {} })

    const ответ = обработчик(адрес, тело)
    if (ответ instanceof Error) {
      throw ответ
    }
    return {
      status: ответ.status ?? 200,
      json: async () => ответ.body ?? {},
    } as any
  })

  return { вызовы, мок }
}

export const ЧЗ = "https://chz.test"
export const АТОЛ = "https://atol.test/v5"

// образец кода из методических рекомендаций ЦРПТ и код в формате нашего
// склада (01 + GTIN + 21 + серийный, GS, 93 + криптохвост)
export const КОД_1 = "01048657365749062155esJWe\u001d93dGVz"
export const КОД_2 = "0104600000000017215abcDEF\u001d93Ab12"

export const ответПоКоду = (cis: string, поля: Record<string, unknown> = {}) => ({
  cis,
  valid: true,
  printView: cis.split("\u001d")[0],
  verified: true,
  found: true,
  realizable: true,
  utilised: true,
  isBlocked: false,
  isOwner: true,
  sold: false,
  errorCode: 0,
  ...поля,
})
