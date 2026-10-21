import { сводкаВладельцу } from "../zakaz-vladelcu"

describe("сводка заказа владельцу", () => {
  it("номер и сумма в теме, позиции и доставка в тексте", () => {
    const { тема, текст } = сводкаВладельцу(
      {
        display_id: 12,
        email: "pokupatel@example.com",
        total: 10294,
        currency_code: "rub",
        items: [{ title: "Брюки прямые, чёрный", variant_title: "44 / 170", quantity: 1 }],
      },
      { способ: "Пункт выдачи, СДЭК", адрес: "Казань, ул. Баумана, 51" }
    )
    expect(тема).toMatch(/^Новый заказ № 12 на 10\s294\s₽$/)
    expect(текст).toContain("Брюки прямые, чёрный, 44 / 170 — 1 шт.")
    expect(текст).toContain("Куда: Казань, ул. Баумана, 51")
    expect(текст).toContain("Покупатель: pokupatel@example.com")
  })

  it("пустой заказ не ломает текст", () => {
    const { тема, текст } = сводкаВладельцу({}, { способ: null, адрес: null })
    expect(тема).toContain("№ ?")
    expect(текст).not.toContain("undefined")
  })
})
