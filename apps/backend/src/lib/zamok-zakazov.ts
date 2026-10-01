import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Замок на заказы, пока магазин не открыт.
 *
 * Пароль на витрине в nginx от этого не спасает: API открыт всему миру
 * (его ждут склад и вебхук банка), а /store проксирует ещё и админский
 * домен. Поэтому оформить заказ и начать оплату пускаем только сервер
 * витрины — он один знает VITRINA_KLYUCH и подставляет его в запрос.
 *
 * Открываем магазин одной переменной: ZAKAZY_OTKRYTY=true.
 *
 * Всё, что прошло через замок, пока магазин закрыт, — пробные заказы
 * самого Тимофея. Помечаем их metadata.test: Medusa переносит
 * метаданные корзины в заказ, а склад такие заказы не видит.
 */
export const ЗАГОЛОВОК_ВИТРИНЫ = "x-vitrina-klyuch"

export const магазинОткрыт = () => process.env.ZAKAZY_OTKRYTY === "true"

const совпадает = (пришёл: string, наш: string) =>
  пришёл.length === наш.length &&
  пришёл.split("").reduce((р, с, и) => р | (с.charCodeAt(0) ^ наш.charCodeAt(и)), 0) === 0

export function пускатьТолькоВитрину(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (магазинОткрыт()) {
    return next()
  }

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const нашКлюч = process.env.VITRINA_KLYUCH

  // Ключ не задан — значит, никого: закрытый магазин без ключа
  // должен оставаться закрытым, а не распахиваться.
  const пришёл = String(req.headers[ЗАГОЛОВОК_ВИТРИНЫ] ?? "")

  if (!нашКлюч || !совпадает(пришёл, нашКлюч)) {
    logger.warn(`Замок: попытка оформить заказ до открытия — ${req.method} ${req.path}`)
    return res.status(403).json({ message: "Магазин ещё не открыт" })
  }

  next()
}

/** Ставит корзине пометку «тест», пока магазин закрыт. */
export async function пометитьПробную(req: MedusaRequest, cartId: string) {
  if (магазинОткрыт()) {
    return
  }

  const carts = req.scope.resolve(Modules.CART)
  const корзина = await carts.retrieveCart(cartId, { select: ["id", "metadata"] })

  if (корзина.metadata?.test === true) {
    return
  }

  await carts.updateCarts(cartId, {
    metadata: { ...(корзина.metadata ?? {}), test: true },
  })
}

/**
 * Для штатного «оформить заказ»: пометка ставится до того, как корзина
 * превратится в заказ.
 */
export async function пометитьПередОформлением(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    await пометитьПробную(req, req.params.id)
  } catch (ошибка: any) {
    // Без пометки пробный заказ уйдёт складу — лучше не оформлять вовсе
    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(`Замок: не удалось пометить корзину ${req.params.id} — ${ошибка?.message}`)
    return res.status(500).json({ message: "Не удалось оформить заказ" })
  }

  next()
}

/** Заказ пробный — склад его не собирает. */
export const пробный = (заказ: { metadata?: Record<string, unknown> | null }) =>
  заказ.metadata?.test === true
