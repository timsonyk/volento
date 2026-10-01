import { BigNumber } from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  WebhookActionResult,
} from "@medusajs/framework/types"
import { TochkaService } from "medusa-payment-tochka/providers/payment-tochka/services"

/**
 * Провайдер Точки — плагин medusa-payment-tochka с тремя поправками.
 *
 * Плагин не правим, а наследуемся: так он переживёт обновление, а все
 * наши отличия собраны в одном файле.
 *
 * 1. СБП. У плагина способы оплаты зашиты в paymentOptions, и там пусто —
 *    значит, только карта. Включаем карту и СБП.
 *
 * 2. Сумма. Medusa присылает её объектом BigNumber, а плагин делает из
 *    неё число через parseFloat — на объекте это NaN, и банк отвечает
 *    ошибкой. Приводим сами.
 *
 * 3. Вебхук. Точка шлёт голую строку JWT с типом text/plain, Medusa
 *    кладёт её в data — плагин её там и ждёт. Но если тип вдруг будет
 *    другим, строка останется только в сыром теле (rawData), а после
 *    очереди событий оно приходит как {type: "Buffer", data: [...]}.
 *    Достаём строку откуда получится.
 *
 * Чеки здесь не выбиваются (withReceipt выключен): все товары с
 * маркировкой, коды знает только склад при сборке, поэтому чеки шлём
 * сами через кассу — см. DEPLOY.md, «Касса».
 */
class OplataTochkaService extends TochkaService {
  static identifier = "tochka"

  // значения из перечисления AcquiringPaymentMode пакета tochka-sdk
  get paymentOptions(): any {
    return { paymentMode: ["card", "sbp"] }
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    return super.initiatePayment({
      ...input,
      amount: String(new BigNumber(input.amount).numeric),
      // Торговая точка в Точке. Банк требует её, если точек у клиента
      // несколько (в песочнице их две) — задаём явно всегда.
      data: { ...input.data, merchantId: input.data?.merchantId ?? process.env.TOCHKA_MERCHANT_ID },
    })
  }

  /**
   * Сверка перед тем, как считать заказ оплаченным.
   *
   * Плагин верит любому «APPROVED» и не смотрит, на какую операцию и на
   * какую сумму пришёл ответ. Мы проверяем оба: номер операции должен
   * совпасть с нашим, а оплачено — не меньше, чем мы просили (сумму банк
   * вернул нам при создании ссылки, она лежит в данных сессии). Иначе
   * оставляем «ожидает» — заказ не оформится, а в журнале будет запись.
   *
   * Песочница на любой вопрос отвечает «APPROVED, 100 ₽» по чужой
   * операции, поэтому там сверку только записываем, а не применяем.
   */
  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const итог = await super.authorizePayment(input)

    if (итог.status !== "authorized" && итог.status !== "captured") {
      return итог
    }

    const наша: any = input.data ?? {}
    const ответ: any = итог.data ?? {}
    const нашаОперация = наша.operationId ?? наша.id
    const просили = Number(наша.amount)
    const оплачено = Number(ответ.amount)

    const расхождение =
      ответ.operationId !== нашаОперация
        ? `операция ${ответ.operationId} вместо ${нашаОперация}`
        : !(оплачено >= просили)
          ? `оплачено ${оплачено} при сумме ${просили}`
          : null

    if (!расхождение) {
      return итог
    }

    if (this.options.developerMode) {
      this.logger_.warn(`Точка (песочница): ${расхождение} — в бою заказ бы не оформился`)
      return итог
    }

    this.logger_.error(`Точка: оплата не засчитана — ${расхождение}`)
    return { status: "pending", data: input.data ?? {} }
  }

  /**
   * Код клиента в Точке. Плагин каждый раз спрашивает список клиентов и
   * ищет среди них юрлицо — лишний запрос на каждую оплату, а в
   * песочнице юрлица нет вовсе (там одно физлицо «Тестов Т.Т.»), и
   * оплата падала бы с «Customer code is undefined». Код можно задать
   * переменной TOCHKA_CUSTOMER_CODE; в песочнице берём первого клиента.
   */
  async getCustomerCodeForPayment(): Promise<string | undefined> {
    if (process.env.TOCHKA_CUSTOMER_CODE) {
      return process.env.TOCHKA_CUSTOMER_CODE
    }

    const код = await super.getCustomerCodeForPayment()
    if (код || !this.options.developerMode) {
      return код
    }

    const sdk: any = (this as any).tochkaSDK_
    const { data } = await sdk.OpenBanking.getCustomersList(sdk.getApiVersion())
    return data?.Data?.Customer?.[0]?.customerCode
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    return super.getWebhookActionAndData({ ...payload, data: строкаJwt(payload) as any })
  }
}

const строкаJwt = (payload: ProviderWebhookPayload["payload"]): string | undefined => {
  const данные: unknown = payload.data
  if (typeof данные === "string") {
    return данные.trim()
  }

  const сырое: any = payload.rawData
  if (!сырое) {
    return undefined
  }
  if (typeof сырое === "string") {
    return сырое.trim()
  }
  if (Buffer.isBuffer(сырое)) {
    return сырое.toString("utf8").trim()
  }
  if (сырое.type === "Buffer" && Array.isArray(сырое.data)) {
    return Buffer.from(сырое.data).toString("utf8").trim()
  }
  return undefined
}

export default OplataTochkaService
