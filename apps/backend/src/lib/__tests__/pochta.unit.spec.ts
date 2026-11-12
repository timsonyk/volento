import { отправить, тестовыйАдрес } from "../pochta"
import { позвать } from "../trevoga"

const scope = (создано: any[], журнал: string[] = []) =>
  ({
    resolve: (имя: string) =>
      имя === "logger"
        ? { info: (с: string) => журнал.push(с), error() {}, warn() {} }
        : { createNotifications: async (у: any) => (создано.push(...[у].flat()), [у].flat()) },
  }) as any

describe("письма только на настоящие адреса", () => {
  it("узнаём тестовые адреса", () => {
    expect(тестовыйАдрес("e2e-ui-123@example.com")).toBe(true)
    expect(тестовыйАдрес(" Sklad@Example.org ")).toBe(true)
    expect(тестовыйАдрес("a@shop.test")).toBe(true)
    expect(тестовыйАдрес("anna@yandex.ru")).toBe(false)
    expect(тестовыйАдрес("example.com@gmail.com")).toBe(false)
    expect(тестовыйАдрес("zakaz@volento.com")).toBe(false)
  })

  it("письмо на @example.com не уходит, остальное уходит", async () => {
    const создано: any[] = []
    await отправить(scope(создано), { to: "e2e-1@example.com", channel: "email", template: "kod" })
    expect(создано).toHaveLength(0)

    await отправить(scope(создано), [
      { to: "e2e-1@example.com", channel: "email", template: "kod" },
      { to: "anna@yandex.ru", channel: "email", template: "kod" },
      { to: "", channel: "feed", template: "admin-ui" },
    ])
    expect(создано.map((у) => у.to)).toEqual(["anna@yandex.ru", ""])
  })

  it("по тестовому заказу человека не зовём", async () => {
    process.env.EMAIL_TREVOGA = "zakaz@volento.com"
    const создано: any[] = []
    await позвать(scope(создано), { тема: "т", текст: "т", тест: true })
    expect(создано).toHaveLength(0)
    await позвать(scope(создано), { тема: "т", текст: "т" })
    expect(создано.some((у) => у.to === "zakaz@volento.com")).toBe(true)
  })
})
