import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { отправить } from "./pochta"

/**
 * «Сообщить, когда появится».
 *
 * Покупатель выбрал на витрине размер, которого нет, и попросил написать
 * ему. Просьбы лежат у покупателя в metadata.zhdu (их кладёт витрина,
 * lib/data/zhdu.ts): [{ v: id размера, t: когда попросил }].
 *
 * Раз в четверть часа (jobs/postuplenie.ts) смотрим, какие из размеров
 * появились, и шлём одно письмо на покупателя со всеми появившимися.
 * Просьбу снимаем ДО отправки: если письмо не уйдёт, покупатель потеряет
 * одно письмо, а не получит одно и то же каждые 15 минут.
 */
export type Ожидание = { v: string; t: string }

export type Размер = { id: string; название: string; вариант: string; адрес: string }

/** Просьба живёт полгода: дальше человеку уже не до этого размера. */
export const ЖИВЁТ_МС = 180 * 24 * 60 * 60 * 1000

const ПОХОЖЕ_НА_ID = /^variant_[A-Za-z0-9]+$/

/** Читает просьбы из метаданных: всё, что не похоже на просьбу, отбрасывает. */
export function разобратьОжидания(metadata: unknown): Ожидание[] {
  const сырые = (metadata as any)?.zhdu
  if (!Array.isArray(сырые)) return []
  return сырые
    .filter((о) => о && typeof о.v === "string" && ПОХОЖЕ_НА_ID.test(о.v))
    .map((о) => ({ v: о.v, t: typeof о.t === "string" ? о.t : "" }))
    .slice(-30)
}

/**
 * Делит просьбы на три кучки: о чём пора написать, что ждёт дальше и
 * что устарело.
 */
export function разделить(ожидания: Ожидание[], вНаличии: Set<string>, сейчас: number) {
  const сообщить: Ожидание[] = []
  const оставить: Ожидание[] = []
  let устарело = 0
  for (const о of ожидания) {
    const когда = Date.parse(о.t)
    if (вНаличии.has(о.v)) сообщить.push(о)
    else if (Number.isFinite(когда) && сейчас - когда > ЖИВЁТ_МС) устарело++
    else оставить.push(о)
  }
  return { сообщить, оставить, устарело }
}

const экранировать = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export const темаПоступления = (размеры: Размер[]) =>
  размеры.length === 1
    ? `${размеры[0].название} снова в наличии — Volento`
    : "Ваши размеры снова в наличии — Volento"

export function текстПоступления(имя: string | null | undefined, размеры: Размер[]) {
  return [
    имя ? `${имя}, здравствуйте!` : "Здравствуйте!",
    "",
    "Вы просили сообщить, когда появится размер. Он снова в наличии:",
    "",
    ...размеры.flatMap((р) => [`${р.название}, ${р.вариант}`, р.адрес, ""]),
    "Вещь за вами не закреплена, размер могут купить раньше.",
    "Это письмо разовое, больше про этот размер мы писать не будем.",
    "",
    "Volento",
  ].join("\n")
}

export function письмоПоступления(имя: string | null | undefined, размеры: Размер[]) {
  const строки = размеры
    .map(
      (р) => `
        <tr><td style="padding:14px 0;border-bottom:1px solid #E2E2E2;font-size:14px;line-height:1.6;color:#0B0B0B;">
          ${экранировать(р.название)}<br>
          <span style="color:#767676;">${экранировать(р.вариант)}</span><br>
          <a href="${экранировать(р.адрес)}" style="color:#0B0B0B;">Открыть на сайте</a>
        </td></tr>`
    )
    .join("")

  return `<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F1F1F1;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F1F1;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;">
        <tr><td style="padding:32px 28px 0;">
          <div style="font-size:22px;letter-spacing:0.16em;color:#0B0B0B;">VOLENTO</div>
        </td></tr>
        <tr><td style="padding:28px 28px 0;">
          <p style="margin:0;font-size:18px;color:#0B0B0B;">
            ${имя ? `${экранировать(имя)}, размер снова в наличии` : "Размер снова в наличии"}
          </p>
          <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#767676;">
            Вы просили сообщить, когда он появится.
          </p>
        </td></tr>
        <tr><td style="padding:12px 28px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${строки}</table>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#767676;">
            Вещь за вами не закреплена, размер могут купить раньше.
            Это письмо разовое, больше про этот размер мы писать не будем.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/**
 * Какие из размеров сейчас можно купить, с названиями для письма.
 * Тот же счёт остатков, что в /store/v-nalichii. Снятые с продажи и
 * неопубликованные товары не считаются появившимися.
 */
const запросНаличия = (сколько: number) => `
  with u as (
    select inventory_item_id, sum(stocked_quantity - reserved_quantity) as svobodno
    from inventory_level where deleted_at is null group by 1
  ),
  p as (
    select l.variant_id, bool_and(coalesce(u.svobodno, 0) >= l.required_quantity) as ok
    from product_variant_inventory_item l
    left join u on u.inventory_item_id = l.inventory_item_id
    where l.deleted_at is null group by 1
  )
  select v.id, v.title as variant, t.title as nazvanie, t.handle
  from product_variant v
  join product t on t.id = v.product_id and t.deleted_at is null and t.status = 'published'
  left join p on p.variant_id = v.id
  where v.deleted_at is null
    and v.id in (${Array.from({ length: сколько }, () => "?").join(",")})
    and (v.manage_inventory = false or v.allow_backorder = true or p.ok)
`

export async function проверитьПоступления(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const сайт = (process.env.STOREFRONT_URL ?? "").replace(/\/+$/, "")
  if (!сайт) {
    logger.warn("Поступления: STOREFRONT_URL не задан, письма не отправляем")
    return
  }

  try {
    const база: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const { rows: покупатели } = await база.raw(
      `select id, email, first_name, metadata from customer
       where deleted_at is null and jsonb_exists(metadata, 'zhdu')`
    )
    const ждут = (покупатели as any[])
      .map((п) => ({ ...п, ожидания: разобратьОжидания(п.metadata) }))
      .filter((п) => п.ожидания.length)
    if (!ждут.length) return

    const ids = [...new Set(ждут.flatMap((п) => п.ожидания.map((о: Ожидание) => о.v)))]
    const { rows: есть } = await база.raw(запросНаличия(ids.length), ids)
    const поId = new Map<string, any>((есть as any[]).map((р) => [String(р.id), р]))
    const вНаличии = new Set(поId.keys())

    const customers = container.resolve(Modules.CUSTOMER)
    const сейчас = Date.now()
    let писем = 0

    for (const п of ждут) {
      const { сообщить, оставить, устарело } = разделить(п.ожидания, вНаличии, сейчас)
      if (!сообщить.length && !устарело) continue

      try {
        // сначала снимаем просьбу, потом пишем (см. шапку файла)
        await customers.updateCustomers(п.id, {
          metadata: { ...(п.metadata ?? {}), zhdu: оставить },
        })
        if (!сообщить.length || !п.email) continue

        const размеры: Размер[] = сообщить.map((о) => {
          const р = поId.get(о.v)
          return {
            id: о.v,
            название: String(р.nazvanie ?? ""),
            вариант: String(р.variant ?? ""),
            адрес: `${сайт}/ru/products/${р.handle}?v_id=${о.v}`,
          }
        })
        await отправить(container, {
          to: п.email,
          channel: "email",
          template: "postuplenie",
          content: {
            subject: темаПоступления(размеры),
            html: письмоПоступления(п.first_name, размеры),
            text: текстПоступления(п.first_name, размеры),
          },
          data: { replyTo: process.env.EMAIL_REPLY_TO },
        })
        писем++
      } catch (ошибка: any) {
        logger.error(`Поступления: покупатель ${п.id}, письмо не ушло — ${ошибка?.message}`)
      }
    }

    if (писем) logger.info(`Поступления: отправлено писем — ${писем}`)
  } catch (ошибка: any) {
    logger.error(`Поступления: проверка не прошла — ${ошибка?.message}`)
  }
}
