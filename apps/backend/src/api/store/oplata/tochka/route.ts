import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  getVariantAvailability,
} from "@medusajs/framework/utils"
import {
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
} from "@medusajs/medusa/core-flows"

import { пометитьПробную } from "../../../../lib/zamok-zakazov"

/**
 * Ссылка на оплату в Точке.
 *
 * Почему не штатная ручка Medusa «начать оплату»: плагину Точки для чека
 * и суммы нужна сама корзина, и штатно её присылает браузер. Тогда
 * состав и сумму мог бы подменить кто угодно. Здесь корзину берём из
 * базы сами, а от витрины получаем только её номер.
 *
 * Пока магазин закрыт, сюда пускает только сервер витрины
 * (api/middlewares.ts, lib/zamok-zakazov.ts).
 */
const ПРОВАЙДЕР = "pp_tochka_tochka"

/**
 * Сколько живёт ссылка, в минутах. Дольше незачем: человек либо платит
 * сразу, либо уходит, а старая ссылка с прежней суммой опасна.
 */
const ЖИВЁТ_МИНУТ = 60

/** Повторное нажатие «Оплатить» в эти минуты отдаёт ту же ссылку. */
const ТА_ЖЕ_ССЫЛКА_МИНУТ = 45

const ВИТРИНА = process.env.VITRINA_URL || "https://slytn.ru"

type Тело = { cart_id?: string; country_code?: string }

export async function POST(req: MedusaRequest<Тело>, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const cartId = String(req.body?.cart_id ?? "")
  const страна = /^[a-z]{2}$/.test(String(req.body?.country_code)) ? req.body!.country_code! : "ru"

  if (!cartId) {
    return res.status(400).json({ message: "Не указана корзина" })
  }

  const {
    data: [корзина],
  } = await query.graph({
    entity: "cart",
    filters: { id: cartId },
    fields: [
      "id",
      "email",
      "currency_code",
      "completed_at",
      "sales_channel_id",
      "total",
      "shipping_total",
      "items.*",
      "items.variant.manage_inventory",
      "items.variant.allow_backorder",
      "shipping_address.*",
      "shipping_methods.name",
      "payment_collection.id",
      "payment_collection.amount",
      "payment_collection.payment_sessions.*",
    ],
  })

  if (!корзина) {
    return res.status(404).json({ message: "Корзина не найдена" })
  }
  if (корзина.completed_at) {
    return res.status(409).json({ message: "Заказ по этой корзине уже оформлен" })
  }
  if (!корзина.items?.length || !корзина.email || !корзина.shipping_address || !корзина.shipping_methods?.length) {
    return res.status(400).json({ message: "Заполните адрес, почту и доставку" })
  }

  // Деньги берём до того, как Medusa спишет остаток, — поэтому проверяем
  // наличие ещё раз. Если пара ушла, пока человек заполнял адрес, лучше
  // сказать сейчас, чем возвращать деньги потом.
  const сУчётом = (корзина.items as any[]).filter(
    (и) => и?.variant_id && и.variant?.manage_inventory && !и.variant?.allow_backorder
  )
  if (сУчётом.length) {
    const наличие = await getVariantAvailability(query, {
      variant_ids: сУчётом.map((и) => и.variant_id),
      sales_channel_id: корзина.sales_channel_id!,
    })
    const нехватка = сУчётом.filter(
      (и) => Number(наличие[и.variant_id]?.availability ?? 0) < Number(и.quantity)
    )
    if (нехватка.length) {
      return res.status(409).json({
        message: "Часть товаров закончилась, обновите корзину",
        nehvatka: нехватка.map((и) => и.variant_id),
      })
    }
  }

  try {
    await пометитьПробную(req, корзина.id)

    let коллекция: any = корзина.payment_collection
    if (!коллекция) {
      await createPaymentCollectionForCartWorkflow(req.scope).run({
        input: { cart_id: корзина.id },
      })
      const { data: [свежая] } = await query.graph({
        entity: "cart",
        filters: { id: корзина.id },
        fields: ["payment_collection.id", "payment_collection.amount", "payment_collection.payment_sessions.*"],
      })
      коллекция = свежая.payment_collection
    }

    // Двойное нажатие или возврат со страницы банка: если живая ссылка
    // на ту же сумму уже есть, отдаём её. Новая сессия удалила бы
    // старую, а оплата по старой ссылке тогда пришла бы в никуда.
    const прежняя = (коллекция.payment_sessions ?? []).find(
      (с: any) =>
        с.provider_id === ПРОВАЙДЕР &&
        с.status === "pending" &&
        с.data?.paymentLink &&
        Number(с.amount) === Number(коллекция.amount) &&
        Date.now() - new Date(с.created_at).getTime() < ТА_ЖЕ_ССЫЛКА_МИНУТ * 60_000
    )
    if (прежняя) {
      return res.json({ ssylka: прежняя.data.paymentLink })
    }

    const возврат = `${ВИТРИНА}/${страна}/checkout/oplata?cart=${корзина.id}`

    const { result: сессия } = await createPaymentSessionsWorkflow(req.scope).run({
      input: {
        payment_collection_id: коллекция.id,
        provider_id: ПРОВАЙДЕР,
        data: {
          cart: корзина,
          redirectUrl: возврат,
          failRedirectUrl: `${возврат}&otkaz=1`,
          ttl: ЖИВЁТ_МИНУТ,
          purpose: `Оплата заказа в Volento`,
        },
      },
    })

    const ссылка = (сессия as any)?.data?.paymentLink
    if (!ссылка) {
      logger.error(`Точка: банк не вернул ссылку для корзины ${корзина.id}`)
      return res.status(502).json({ message: "Банк не ответил, попробуйте ещё раз" })
    }

    return res.json({ ssylka: ссылка })
  } catch (ошибка: any) {
    logger.error(`Точка: не создали оплату для корзины ${корзина.id} — ${ошибка?.message}`)
    return res.status(502).json({ message: "Не удалось перейти к оплате, попробуйте ещё раз" })
  }
}
