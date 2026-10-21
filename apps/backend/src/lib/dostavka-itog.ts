import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { markOrderFulfillmentAsDeliveredWorkflow, refundPaymentWorkflow } from "@medusajs/medusa/core-flows"

import { чекВозврата, чекРасчёта } from "./kassa"
import { ИТОГ, type Итог } from "./primerka"
import { этоТест } from "./sklad-test-metka"
import { позвать } from "./trevoga"

/**
 * Посылку выдали — подводим итог: что покупатель забрал, а что едет
 * обратно. Статусы приносит сторож jobs/dostavka-statusy.ts, у тестовых
 * заказов — /sklad/proba/vydacha.
 *
 * 1. Записываем итог в заказ (metadata.dostavka_itog по сборке).
 * 2. Чек «полный расчёт» — на забранные пары с их кодами (и на доставку).
 * 3. Деньги за незабранное — обратно на карту, через Точку.
 * 4. Чек «возврат предоплаты» на незабранное.
 * 5. Сборку — в «доставлена», покупателю — письмо, нам — сводку.
 *
 * Каждый шаг отмечаем в заказе. Упали посередине — сторож придёт снова и
 * продолжит с того же места: деньги дважды не вернутся.
 */
type Этап = "zapisan" | "chek" | "dengi" | "gotovo"

export type ИтогСборки = Итог & {
  status: string
  kogda: string
  etap: Этап
  vernuli?: number
  // склад принял невыкупленное обратно (POST /sklad/zadaniya/:nomer/vozvrat)
  prinyat?: { kogda: string; kody: string[]; sovpalo: boolean }
  // уже звали человека по этой сборке — чтобы не звать каждые 15 минут
  trevoga?: string
}

const ПОЛЯ = [
  "id",
  "display_id",
  "email",
  "metadata",
  "items.id",
  "items.title",
  "items.variant_title",
  "items.variant_sku",
  "items.total",
  "items.detail.quantity",
  "shipping_address.first_name",
  "payment_collections.payments.id",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
  "payment_collections.payments.refunds.note",
]

async function прочитать(scope: MedusaContainer, id: string) {
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    filters: { id },
    fields: ПОЛЯ,
  })
  const заказ: any = data?.[0]
  if (!заказ) {
    throw new Error(`Заказ ${id} не найден`)
  }
  return заказ
}

export const итогиЗаказа = (заказ: any): Record<string, ИтогСборки> => (заказ?.metadata ?? {})[ИТОГ] ?? {}

/** Записать итог сборки — свежими данными, чтобы не затереть чужое в metadata. */
export async function записатьИтог(scope: MedusaContainer, idЗаказа: string, idСборки: string, правка: Partial<ИтогСборки>) {
  const orderModule = scope.resolve(Modules.ORDER)
  const [свежий] = await orderModule.listOrders({ id: idЗаказа }, { select: ["id", "metadata"] })
  const итоги = итогиЗаказа(свежий)
  const итог = { ...(итоги[idСборки] ?? {}), ...правка } as ИтогСборки
  await orderModule.updateOrders([
    { id: idЗаказа, metadata: { ...(свежий.metadata ?? {}), [ИТОГ]: { ...итоги, [idСборки]: итог } } },
  ])
  return итог
}

/** Цена одной пары строки — сколько за неё на самом деле заплатили, со скидками. */
const ценаПары = (строка: any) => {
  const штук = Number(строка?.detail?.quantity ?? 0)
  return штук ? Math.round((Number(строка.total) / штук) * 100) / 100 : 0
}

const название = (с: any) => [с?.title, с?.variant_title].filter(Boolean).join(", ")

export async function подвестиИтог(
  scope: MedusaContainer,
  idЗаказа: string,
  idСборки: string,
  статус: string,
  новый?: Итог
) {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
  let заказ = await прочитать(scope, idЗаказа)
  let итог = итогиЗаказа(заказ)[idСборки]

  if (!итог) {
    if (!новый) {
      throw new Error("Итога выдачи нет — нечего подводить")
    }
    итог = await записатьИтог(scope, idЗаказа, idСборки, {
      ...новый,
      status: статус,
      kogda: new Date().toISOString(),
      etap: "zapisan",
    })
    logger.info(
      `Заказ ${заказ.display_id}: выдан, забрали ${штук(итог.vykupleno)} шт., не забрали ${штук(итог.nevykupleno)} шт.`
    )
  }

  if (итог.etap === "gotovo") {
    return итог
  }

  const строки = new Map<string, any>((заказ.items ?? []).map((с: any) => [с.id, с]))

  // 2. Полный расчёт на забранное. Сам чек уходит через очередь касс —
  // не ушёл сейчас, дошлёт сторож чеков.
  if (итог.etap === "zapisan") {
    await чекРасчёта(
      scope,
      idЗаказа,
      idСборки,
      итог.vykupleno.map((с) => ({ id: с.id, quantity: с.kody.length, kody: с.kody }))
    )
    итог = await записатьИтог(scope, idЗаказа, idСборки, { etap: "chek" })
  }

  // 3–4. Деньги и чек возврата за незабранное
  if (итог.etap === "chek") {
    const сумма =
      Math.round(
        итог.nevykupleno.reduce((s, с) => s + ценаПары(строки.get(с.id)) * с.shtuk, 0) * 100
      ) / 100

    if (сумма > 0) {
      const пометка = `Невыкуп в пункте выдачи, сборка ${idСборки}`
      const платежи = (заказ.payment_collections ?? []).flatMap((к: any) => к.payments ?? [])
      const ужеВернули = платежи.some((п: any) => (п.refunds ?? []).some((в: any) => в.note === пометка))

      if (!ужеВернули) {
        const платёж = платежи.find((п: any) => п.captured_at && !п.canceled_at)
        if (!платёж) {
          await позвать(scope, {
            тема: `Заказ ${заказ.display_id}: верните ${сумма} ₽ вручную`,
            текст: `Покупатель не забрал часть посылки, а списанного платежа в заказе нет. Верните деньги в карточке заказа.`,
          })
        } else {
          await refundPaymentWorkflow(scope).run({
            input: { payment_id: платёж.id, amount: сумма, note: пометка },
          })
          logger.info(`Заказ ${заказ.display_id}: вернули ${сумма} ₽ за невыкуп`)
        }
      }

      await чекВозврата(
        scope,
        idЗаказа,
        `nevykup-${idСборки.slice(-8)}`,
        итог.nevykupleno.map((с) => ({ id: с.id, kolichestvo: с.shtuk }))
      )
    }

    итог = await записатьИтог(scope, idЗаказа, idСборки, { etap: "dengi", vernuli: сумма })
  }

  // 5. Сборка доставлена (если хоть что-то забрали), письма
  if (итог.vykupleno.length) {
    try {
      await markOrderFulfillmentAsDeliveredWorkflow(scope).run({
        input: { orderId: idЗаказа, fulfillmentId: idСборки },
      })
    } catch (ошибка: any) {
      // уже отмечена — не беда
      logger.warn(`Заказ ${заказ.display_id}: сборку не отметили доставленной — ${ошибка?.message}`)
    }
  }

  заказ = await прочитать(scope, idЗаказа)
  if (итог.nevykupleno.length && !этоТест(заказ)) {
    await письмоПокупателю(scope, заказ, итог, строки).catch((ошибка) =>
      logger.error(`Заказ ${заказ.display_id}: письмо о невыкупе не ушло — ${ошибка?.message}`)
    )
    await позвать(scope, {
      тема: `Заказ ${заказ.display_id}: покупатель забрал не всё`,
      текст:
        `Не забрали:\n${итог.nevykupleno.map((с) => `${название(строки.get(с.id))} — ${с.shtuk} шт.`).join("\n")}\n\n` +
        `Вернули покупателю ${итог.vernuli ?? 0} ₽, чеки пробиты. Посылка с невыкупленным едет на склад.` +
        (итог.netochno
          ? `\n\nСлужба не сказала, какая из одинаковых пар вернулась. Склад при приёме возврата пришлёт коды — если не совпадут, позовём ещё раз.`
          : ""),
    })
  }

  return записатьИтог(scope, idЗаказа, idСборки, { etap: "gotovo" })
}

const штук = (с: { shtuk: number }[]) => с.reduce((s, x) => s + x.shtuk, 0)

const экранировать = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

async function письмоПокупателю(scope: MedusaContainer, заказ: any, итог: ИтогСборки, строки: Map<string, any>) {
  if (!заказ.email) {
    return
  }

  const имя = заказ.shipping_address?.first_name
  const список = (с: { id: string; shtuk: number }[]) =>
    с.map((x) => `${название(строки.get(x.id))}${x.shtuk > 1 ? ` × ${x.shtuk}` : ""}`)
  const забрали = список(итог.vykupleno)
  const нет = список(итог.nevykupleno)
  const деньги = итог.vernuli
    ? `Вернули ${итог.vernuli} ₽ на карту, которой вы платили. Деньги придут в течение нескольких дней — срок зависит от банка.`
    : ""

  const текст = [
    имя ? `${имя}, спасибо за заказ ${заказ.display_id}!` : `Спасибо за заказ ${заказ.display_id}!`,
    "",
    ...(забрали.length ? ["Вы забрали:", ...забрали.map((с) => `— ${с}`), ""] : []),
    "Не забрали:",
    ...нет.map((с) => `— ${с}`),
    "",
    деньги,
    "Вопросы — просто ответьте на это письмо.",
  ]
    .filter((с, i, все) => с !== "" || все[i - 1] !== "")
    .join("\n")

  const абзац = (с: string) => `<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#767676;">${с}</p>`
  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F1F1F1;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F1F1;padding:24px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;">
      <tr><td style="padding:32px 28px 0;"><div style="font-size:22px;letter-spacing:0.16em;color:#0B0B0B;">VOLENTO</div></td></tr>
      <tr><td style="padding:28px 28px 0;">
        <p style="margin:0;font-size:18px;color:#0B0B0B;">${экранировать(имя ? `${имя}, спасибо за заказ!` : "Спасибо за заказ!")}</p>
        ${забрали.length ? абзац(`Вы забрали: ${забрали.map(экранировать).join("; ")}.`) : ""}
        ${абзац(`Не забрали: ${нет.map(экранировать).join("; ")}.`)}
        ${деньги ? абзац(экранировать(деньги)) : ""}
      </td></tr>
      <tr><td style="padding:28px;"><p style="margin:0;font-size:13px;line-height:1.6;color:#767676;">Вопросы — просто ответьте на это письмо, оно придёт нам.</p></td></tr>
    </table>
  </td></tr></table>
</body></html>`

  await scope.resolve(Modules.NOTIFICATION).createNotifications({
    to: заказ.email,
    channel: "email",
    template: "zakaz-nevykup",
    content: { subject: `Заказ ${заказ.display_id}: возврат за невыкупленное — Volento`, html, text: текст },
    data: { replyTo: process.env.EMAIL_REPLY_TO },
  } as any)
}
