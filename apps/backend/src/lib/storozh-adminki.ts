import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { Сторож, ктоПросит } from "./chastota"

/**
 * Вход в админку по почте и паролю: не даём подбирать пароль.
 *
 * У Medusa на этом входе счётчика попыток нет, пробовать пароли можно
 * без остановки. Считаем попытки по адресу в сети: не больше ПОПЫТОК за
 * десять минут. Сотруднику этого хватает с запасом, перебору нет.
 *
 * Считаем все попытки, а не только неудачные: так проще и не нужно
 * заглядывать в ответ. Общий предел высокий, он только от совсем
 * массового перебора с разных адресов.
 */
export const ПОПЫТОК_ВХОДА = 10

const сторож = new Сторож(10 * 60 * 1000, ПОПЫТОК_ВХОДА, 1000)

export function сторожитьВходВАдминку(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const кто = ктоПросит(req.headers as Record<string, unknown>)
  const ждать = сторож.пропустить(кто)
  if (ждать) {
    req.scope
      .resolve("logger")
      .warn(`Вход в админку: слишком много попыток (${кто || "изнутри"}), ждать ${ждать} с`)
    const минут = Math.ceil(ждать / 60)
    return res.status(429).json({
      type: "not_allowed",
      message: `Слишком много попыток входа. Попробуйте через ${минут} мин.`,
    })
  }
  next()
}
