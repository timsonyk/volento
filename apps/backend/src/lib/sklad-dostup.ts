import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Пропуск для склада.
 *
 * Ключ отдельный, не от админки: у админского ключа Medusa права на весь
 * магазин — цены, покупателей, выгрузку заказов. Складу нужно ровно
 * четыре действия, и ключ к ним больше ничего не открывает. Если его
 * когда-нибудь уведут, увести смогут только остатки.
 *
 * Дополнительно можно запереть по адресам: SKLAD_IP со списком через
 * запятую. Пусто — проверяем только ключ.
 */
export const ЗАГОЛОВОК_КЛЮЧА = "x-sklad-key"

/** Адрес обратившегося с поправкой на то, что мы стоим за nginx. */
const откудаПришли = (req: MedusaRequest): string => {
  const переданный = String(req.headers["x-forwarded-for"] ?? "")
    .split(",")[0]
    .trim()
  // ::ffff:1.2.3.4 — тот же адрес, просто записанный по-шестому протоколу
  return (переданный || req.socket?.remoteAddress || "").replace(/^::ffff:/, "")
}

export function пускатьСклад(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const нашКлюч = process.env.SKLAD_KEY

  if (!нашКлюч) {
    logger.error("SKLAD_KEY не задан — обмен со складом выключен")
    return res.status(503).json({ ошибка: "Обмен со складом не настроен" })
  }

  const пришёл = String(req.headers[ЗАГОЛОВОК_КЛЮЧА] ?? "")

  // Сравниваем целиком, без досрочного выхода на первом несовпадении:
  // по времени ответа иначе можно подбирать ключ посимвольно.
  const совпал =
    пришёл.length === нашКлюч.length &&
    пришёл.split("").reduce((р, с, и) => р | (с.charCodeAt(0) ^ нашКлюч.charCodeAt(и)), 0) === 0

  if (!совпал) {
    logger.warn(`Склад: неверный ключ с адреса ${откудаПришли(req)}`)
    return res.status(401).json({ ошибка: "Неверный ключ" })
  }

  const разрешённые = (process.env.SKLAD_IP ?? "")
    .split(",")
    .map((а) => а.trim())
    .filter(Boolean)

  if (разрешённые.length) {
    const адрес = откудаПришли(req)
    if (!разрешённые.includes(адрес)) {
      logger.warn(`Склад: ключ верный, но адрес ${адрес} не в списке`)
      return res.status(403).json({ ошибка: "Адрес не разрешён" })
    }
  }

  next()
}
