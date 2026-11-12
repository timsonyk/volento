import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Письма уходят только на настоящие адреса.
 *
 * Автотесты и тестовые заказы склада заводят покупателей на
 * @example.com. Такого ящика нет: каждое письмо возвращалось отказом
 * Mailer-Daemon в почту магазина и портило репутацию отправителя. Письма
 * на заведомо несуществующие адреса не отправляем вовсе — в журнале
 * остаётся строка, что письмо было бы.
 *
 * example.com, example.org, example.net и зоны .test, .invalid, .example
 * отданы под примеры и тесты (RFC 2606): настоящих покупателей там нет.
 */
const НЕНАСТОЯЩИЙ = /@(example\.(com|org|net)|[^@]*\.(test|invalid|example))$/i

export const тестовыйАдрес = (адрес?: string | null) =>
  НЕНАСТОЯЩИЙ.test(String(адрес ?? "").trim())

/** То же, что createNotifications, но без писем на тестовые адреса. */
export async function отправить(scope: MedusaContainer, уведомления: any | any[]) {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
  const список = (Array.isArray(уведомления) ? уведомления : [уведомления]).filter((у) => {
    if (у?.channel === "email" && тестовыйАдрес(у.to)) {
      logger.info(`Письмо «${у.template ?? ""}» на тестовый адрес ${у.to} не отправляем`)
      return false
    }
    return true
  })

  if (!список.length) {
    return []
  }

  return scope.resolve(Modules.NOTIFICATION).createNotifications(список)
}
