import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { refundPaymentWorkflow } from "@medusajs/medusa/core-flows"

import { итогиЗаказа } from "./dostavka-itog"
import { чекВозвратаТовара } from "./kassa"
import { этоТест } from "./sklad-test-metka"
import { позвать } from "./trevoga"
import { отправить } from "./pochta"

/**
 * Возврат через кабинет: покупатель выбирает заказ, отмечает пары и
 * отправляет заявку. Склад принимает посылку кодами
 * (POST /sklad/zadaniya/:nomer/vozvrat) — за принятые пары деньги уходят
 * на карту, а чек «возврат прихода» с кодами возвращает их в оборот
 * «Честного знака».
 *
 * Вернуть можно то, что покупатель забрал в пункте выдачи (итог выдачи —
 * lib/dostavka-itog.ts), в течение семи дней после получения: памятку о
 * возврате склад кладёт в каждую посылку, поэтому срок семидневный (ст. 26.1
 * закона о защите прав потребителей). Пара в заявке — с её кодом: так склад
 * сверит, что вернулась именно она.
 */
export const ЗАЯВКИ = "vozvraty_pokupatelya"

const ДНЕЙ_НА_ВОЗВРАТ = Number(process.env.VOZVRAT_DNEY || 7)

export type ПараВозврата = { id_stroki: string; kod: string }

export type Заявка = {
  nomer: string
  sozdana: string
  pary: ПараВозврата[]
  prichina?: string
  kommentariy?: string
  // zhdem — ждём посылку; prinyat — всё приняли; chastichno — часть
  // приняли, часть отклонили; otklonen — не приняли ничего
  status: "zhdem" | "prinyat" | "chastichno" | "otklonen"
  prinyato?: {
    kogda: string
    kody: string[]
    otkloneno: { kod: string; prichina: string }[]
    vernuli: number
  }
}

export const ПРИЧИНЫ = ["Не подошёл размер", "Не подошёл рост", "Не понравилась посадка", "Не понравился цвет или ткань", "Брак", "Другое"]

export const заявкиЗаказа = (заказ: any): Заявка[] => (заказ?.metadata ?? {})[ЗАЯВКИ] ?? []

/** Конец дня по Москве, через ДНЕЙ_НА_ВОЗВРАТ дней после получения. */
export function крайнийСрок(получен: string | Date): Date {
  const мск = new Date(new Date(получен).getTime() + 3 * 3600_000)
  мск.setUTCHours(23, 59, 59, 999)
  return new Date(мск.getTime() + ДНЕЙ_НА_ВОЗВРАТ * 86_400_000 - 3 * 3600_000)
}

export type МожноВернуть = {
  до: string | null
  пары: { id_stroki: string; kod: string; nazvanie: string; artikul: string | null }[]
}

/**
 * Что из заказа можно вернуть сейчас: забранные пары, срок по которым не
 * вышел и которые ещё не в заявке.
 */
export function можноВернуть(заказ: any, сейчас = new Date()): МожноВернуть {
  const строки = new Map<string, any>((заказ.items ?? []).map((с: any) => [с.id, с]))
  const заняты = new Set(заявкиЗаказа(заказ).flatMap((з) => з.pary.map((п) => п.kod)))
  let до: Date | null = null
  const пары: МожноВернуть["пары"] = []

  for (const итог of Object.values(итогиЗаказа(заказ))) {
    if (итог.etap !== "gotovo" || !итог.vykupleno?.length) {
      continue
    }
    const срок = крайнийСрок(итог.kogda)
    if (!до || срок > до) до = срок
    if (срок < сейчас) {
      continue
    }
    for (const с of итог.vykupleno) {
      const строка = строки.get(с.id)
      for (const kod of с.kody) {
        if (заняты.has(kod)) continue
        пары.push({
          id_stroki: с.id,
          kod,
          nazvanie: [строка?.title, строка?.variant_title].filter(Boolean).join(", "),
          artikul: строка?.variant_sku ?? null,
        })
      }
    }
  }

  return { до: до ? до.toISOString() : null, пары }
}

const ПОЛЯ = [
  "id",
  "display_id",
  "email",
  "customer_id",
  "metadata",
  "items.id",
  "items.title",
  "items.variant_title",
  "items.variant_sku",
  "items.unit_price",
  "items.total",
  "items.detail.quantity",
  "shipping_address.first_name",
  "payment_collections.payments.id",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
  "payment_collections.payments.refunds.note",
]

export async function прочитатьЗаказ(scope: MedusaContainer, id: string) {
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    filters: { id },
    fields: ПОЛЯ,
  })
  return (data?.[0] as any) ?? null
}

async function записатьЗаявки(scope: MedusaContainer, idЗаказа: string, правка: (з: Заявка[]) => Заявка[]) {
  const orderModule = scope.resolve(Modules.ORDER)
  const [свежий] = await orderModule.listOrders({ id: idЗаказа }, { select: ["id", "metadata"] })
  const заявки = правка([...заявкиЗаказа(свежий)])
  await orderModule.updateOrders([{ id: idЗаказа, metadata: { ...(свежий.metadata ?? {}), [ЗАЯВКИ]: заявки } }])
  return заявки
}

export class ОшибкаВозврата extends Error {}

/** Покупатель оформил возврат. kody — коды выбранных пар. */
export async function создатьЗаявку(
  scope: MedusaContainer,
  idЗаказа: string,
  kody: string[],
  prichina?: string,
  kommentariy?: string
): Promise<Заявка> {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
  const заказ = await прочитатьЗаказ(scope, idЗаказа)
  if (!заказ) {
    throw new ОшибкаВозврата("Заказ не найден")
  }

  const доступно = можноВернуть(заказ)
  const поКоду = new Map(доступно.пары.map((п) => [п.kod, п]))
  const выбрано = [...new Set(kody.map(String))]

  if (!выбрано.length) {
    throw new ОшибкаВозврата("Отметьте, что возвращаете")
  }
  if (!доступно.пары.length) {
    throw new ОшибкаВозврата(
      доступно.до && new Date(доступно.до) < new Date()
        ? "Срок возврата по этому заказу прошёл"
        : "В этом заказе нечего вернуть"
    )
  }
  const чужие = выбрано.filter((к) => !поКоду.has(к))
  if (чужие.length) {
    throw new ОшибкаВозврата("Эти вещи уже в заявке или их нельзя вернуть — обновите страницу")
  }

  const причина = prichina && ПРИЧИНЫ.includes(prichina) ? prichina : undefined
  const заявка: Заявка = {
    nomer: `${заказ.display_id}-В${заявкиЗаказа(заказ).length + 1}`,
    sozdana: new Date().toISOString(),
    pary: выбрано.map((к) => ({ id_stroki: поКоду.get(к)!.id_stroki, kod: к })),
    ...(причина ? { prichina: причина } : {}),
    ...(kommentariy?.trim() ? { kommentariy: kommentariy.trim().slice(0, 1000) } : {}),
    status: "zhdem",
  }

  await записатьЗаявки(scope, заказ.id, (з) => [...з, заявка])
  logger.info(`Заказ ${заказ.display_id}: покупатель оформил возврат ${заявка.nomer}, пар: ${заявка.pary.length}`)

  if (!этоТест(заказ)) {
    const список = заявка.pary.map((п) => `— ${поКоду.get(п.kod)!.nazvanie}`).join("\n")
    await позвать(scope, {
      тема: `Возврат ${заявка.nomer}: покупатель оформил в кабинете`,
      текст:
        `Заказ ${заказ.display_id}, ${заказ.email}.\n\n${список}\n\n` +
        `Причина: ${заявка.prichina ?? "не указана"}${заявка.kommentariy ? `\nКомментарий: ${заявка.kommentariy}` : ""}\n\n` +
        (process.env.VOZVRAT_INSTRUKCIYA
          ? `Покупателю отправлена инструкция, как отправить посылку.`
          : `Напишите покупателю, куда отправить посылку: инструкция VOZVRAT_INSTRUKCIYA не задана.`) +
        `\nКогда посылка придёт, склад примет её кодами — деньги вернутся сами.`,
    })
    await письмо(scope, заказ, заявка.nomer, "zakaz-vozvrat-zayavka", `Заявка на возврат ${заявка.nomer} — Volento`, [
      `Приняли заявку на возврат ${заявка.nomer} по заказу ${заказ.display_id}:`,
      список,
      "",
      инструкция(),
      "",
      "Как только посылка придёт и мы проверим вещи, вернём деньги на карту, которой вы платили, — в течение десяти дней.",
    ]).catch((ошибка) => logger.error(`Письмо о заявке ${заявка.nomer} не ушло — ${ошибка?.message}`))
  }

  return заявка
}

/** Как отправить посылку. Пока адреса нет в настройках — пишем сами. */
export const инструкция = () =>
  process.env.VOZVRAT_INSTRUKCIYA ||
  "В течение рабочего дня пришлём на почту, куда и как отправить посылку. Вещи упакуйте с ярлыками и вложите номер заявки."

const ценаПары = (строка: any) => {
  const штук = Number(строка?.detail?.quantity ?? 0)
  const всего = Number(строка?.total)
  const цена = штук && Number.isFinite(всего) ? всего / штук : Number(строка?.unit_price ?? 0)
  return Number.isFinite(цена) ? Math.round(цена * 100) / 100 : 0
}

export type ИтогПриёмаЗаявки = {
  nomer: string
  status: Заявка["status"]
  prinyato: string[]
  otkloneno: { kod: string; prichina: string }[]
  vernuli: number
}

/**
 * Склад принял посылку по заявкам покупателя: пришедшие коды и, если
 * какие-то пары не годятся (носили, нет ярлыков), — отклонённые с
 * причиной. Коды, которых нет в ждущих заявках, не трогаем — их разбирает
 * вызывающий (это может быть возврат невыкупа).
 */
export async function принятьЗаявки(
  scope: MedusaContainer,
  idЗаказа: string,
  пришли: string[],
  отклонить: { kod: string; prichina: string }[] = []
): Promise<ИтогПриёмаЗаявки[]> {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
  const заказ = await прочитатьЗаказ(scope, idЗаказа)
  const пришлиКоды = new Set(пришли)
  const причинаОтказа = new Map(отклонить.map((о) => [о.kod, о.prichina || "не принят складом"]))
  const строки = new Map<string, any>((заказ.items ?? []).map((с: any) => [с.id, с]))
  const итоги: ИтогПриёмаЗаявки[] = []

  for (const заявка of заявкиЗаказа(заказ).filter((з) => з.status === "zhdem")) {
    const наши = заявка.pary.filter((п) => пришлиКоды.has(п.kod))
    if (!наши.length) {
      continue
    }
    const принять = наши.filter((п) => !причинаОтказа.has(п.kod))
    const отклонено = наши.filter((п) => причинаОтказа.has(п.kod)).map((п) => ({ kod: п.kod, prichina: причинаОтказа.get(п.kod)! }))
    const сумма = Math.round(принять.reduce((s, п) => s + ценаПары(строки.get(п.id_stroki)), 0) * 100) / 100

    if (сумма > 0) {
      const пометка = `Возврат покупателя ${заявка.nomer}`
      const платежи = (заказ.payment_collections ?? []).flatMap((к: any) => к.payments ?? [])
      if (!платежи.some((п: any) => (п.refunds ?? []).some((в: any) => в.note === пометка))) {
        const платёж = платежи.find((п: any) => п.captured_at && !п.canceled_at)
        if (!платёж) {
          await позвать(scope, {
            тест: этоТест(заказ),
            тема: `Возврат ${заявка.nomer}: верните ${сумма} ₽ вручную`,
            текст: `Склад принял возврат, а списанного платежа в заказе нет. Верните деньги в карточке заказа.`,
          })
        } else {
          await refundPaymentWorkflow(scope).run({ input: { payment_id: платёж.id, amount: сумма, note: пометка } })
          logger.info(`Заказ ${заказ.display_id}: вернули ${сумма} ₽ по возврату ${заявка.nomer}`)
        }
      }
      await чекВозвратаТовара(
        scope,
        заказ.id,
        // номер чека — латиницей: «70-В1» → v1
        `v${заявка.nomer.split("В").pop()}`,
        принять.map((п) => ({ id: п.id_stroki, kod: п.kod }))
      )
    }

    const статус: Заявка["status"] = !принять.length ? "otklonen" : отклонено.length ? "chastichno" : "prinyat"
    await записатьЗаявки(scope, заказ.id, (з) =>
      з.map((x) =>
        x.nomer === заявка.nomer
          ? {
              ...x,
              status: статус,
              prinyato: { kogda: new Date().toISOString(), kody: принять.map((п) => п.kod), otkloneno: отклонено, vernuli: сумма },
            }
          : x
      )
    )

    if (!этоТест(заказ)) {
      const название = (п: ПараВозврата) => [строки.get(п.id_stroki)?.title, строки.get(п.id_stroki)?.variant_title].filter(Boolean).join(", ")
      await письмо(scope, заказ, заявка.nomer, "zakaz-vozvrat-prinyat", `Возврат ${заявка.nomer}: ${принять.length ? "деньги возвращены" : "не принят"} — Volento`, [
        ...(принять.length
          ? [`Получили возврат ${заявка.nomer}. Вернули ${сумма} ₽ на карту, которой вы платили — деньги придут в течение нескольких дней, срок зависит от банка.`]
          : [`Получили посылку по возврату ${заявка.nomer}.`]),
        ...(отклонено.length
          ? ["", "Не смогли принять:", ...отклонено.map((о) => `— ${название(заявка.pary.find((п) => п.kod === о.kod)!)}: ${о.prichina}`), "Мы свяжемся с вами, чтобы решить, как быть."]
          : []),
      ]).catch((ошибка) => logger.error(`Письмо о возврате ${заявка.nomer} не ушло — ${ошибка?.message}`))

      if (отклонено.length) {
        await позвать(scope, {
          тест: этоТест(заказ),
          тема: `Возврат ${заявка.nomer}: склад не принял ${отклонено.length} шт.`,
          текст:
            `Заказ ${заказ.display_id}, ${заказ.email}.\n\n${отклонено.map((о) => `${название(заявка.pary.find((п) => п.kod === о.kod)!)}: ${о.prichina}`).join("\n")}\n\n` +
            `Деньги за них не вернули. Свяжитесь с покупателем: вернуть вещи ему или всё же принять.`,
        })
      }
    }

    итоги.push({ nomer: заявка.nomer, status: статус, prinyato: принять.map((п) => п.kod), otkloneno: отклонено, vernuli: сумма })
  }

  return итоги
}

const экранировать = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

async function письмо(scope: MedusaContainer, заказ: any, _номер: string, шаблон: string, тема: string, строки: string[]) {
  if (!заказ.email) {
    return
  }
  const имя = заказ.shipping_address?.first_name
  const текст = [имя ? `${имя}, здравствуйте!` : "Здравствуйте!", "", ...строки, "", "Вопросы — просто ответьте на это письмо."].join("\n")
  const абзацы = текст
    .split("\n\n")
    .map((а) => `<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#0B0B0B;">${экранировать(а).replace(/\n/g, "<br>")}</p>`)
    .join("")
  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F1F1F1;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F1F1;padding:24px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;">
      <tr><td style="padding:32px 28px 0;"><div style="font-size:22px;letter-spacing:0.16em;color:#0B0B0B;">VOLENTO</div></td></tr>
      <tr><td style="padding:16px 28px 28px;">${абзацы}</td></tr>
    </table>
  </td></tr></table>
</body></html>`

  await отправить(scope, {
    to: заказ.email,
    channel: "email",
    template: шаблон,
    content: { subject: тема, html, text: текст },
    data: { replyTo: process.env.EMAIL_REPLY_TO },
  } as any)
}
