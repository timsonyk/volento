import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { позвать } from "./trevoga"
import { видимаяЧасть, отраслевойРеквизит, проверитьКоды, режимПроверки, type ИтогПроверки } from "./chz"

/**
 * Чеки через кассу Атол Онлайн (API v5, ФФД 1.2).
 *
 * Все наши брюки маркированы «Честным знаком», а код пары знает только
 * склад при сборке. Поэтому чеков по заказу несколько:
 *
 * 1. «Предоплата 100 %» — как только деньги списаны. Без кодов: вещи ещё
 *    на полке, какая именно пара уедет, неизвестно.
 * 2. «Полный расчёт» — когда склад собрал заказ и прислал коды. По коду
 *    на каждую пару, предоплата засчитывается. Из этого чека «Честный
 *    знак» узнаёт, что пара продана.
 * 3. «Возврат предоплаты» — если часть заказа не собрали или заказ
 *    отменили до сборки.
 *
 * Каждый чек сначала записываем в заказ (metadata.kassa_cheki), потом
 * отправляем. Не дошёл — сторож jobs/kassa-cheki.ts отправит ещё раз и
 * узнает результат. Номер чека для Атола постоянный, поэтому второй раз
 * один и тот же чек он не пробьёт.
 *
 * Чеки бьём только по деньгам, пришедшим через Точку. Тестовые заказы
 * склада оплачены «системным» способом — по ним касса молчит.
 *
 * Коды в «полном расчёте» перед отправкой проверяются в «Честном знаке»
 * (разрешительный режим). Кто проверяет — мы сами или Атол через ТС ПИоТ,
 * — решает переключатель в lib/chz.ts; применяется он в момент отправки,
 * поэтому переключение подхватят и чеки, которые ещё ждут в очереди.
 */

export const ЧЕКИ = "kassa_cheki"

const ДОСТАВКА = "dostavka"
const ПРОВАЙДЕР_ТОЧКИ = "pp_tochka"

type Вид = "predoplata" | "raschet" | "vozvrat"

type Строка = { id: string; kolichestvo: number; cena: number }

export type Чек = {
  id: string
  vid: Вид
  operaciya: "sell" | "sell_refund"
  stroki: Строка[]
  telo: Record<string, any>
  status: "novyy" | "wait" | "done" | "fail"
  uuid?: string
  oshibka?: string
  ssylka?: string
  popytok: number
  sozdan: string
  // проверка кодов в ЧЗ: коды без криптохвоста, чтобы не хранить их дважды
  proverka?: {
    kogda: string
    avariya?: boolean
    kody?: { vidimyy: string; reqId: string; reqTimestamp: number; zapret: string | null }[]
  }
}

const настройки = () => ({
  адрес: process.env.ATOL_URL || "https://online.atol.ru/possystem/v5",
  логин: process.env.ATOL_LOGIN,
  пароль: process.env.ATOL_PASSWORD,
  группа: process.env.ATOL_GROUP_CODE,
  инн: process.env.ATOL_INN,
  место: process.env.ATOL_PAYMENT_ADDRESS,
  // УСН «доходы», НДС 5 % — подтвердил бухгалтер (13 октября 2026)
  сно: process.env.ATOL_SNO || "usn_income",
  ндс: process.env.ATOL_VAT || "vat5",
  // в предоплате ставка расчётная: 5/105
  ндсПредоплаты: process.env.ATOL_VAT_PREPAYMENT || "vat105",
  почта: process.env.ATOL_EMAIL || "none",
})

export const кассаВключена = () => {
  const н = настройки()
  return Boolean(н.логин && н.пароль && н.группа && н.инн && н.место)
}

const копейки = (x: number) => Math.round(x * 100) / 100

const сейчас = () => {
  const д = new Date(Date.now() + 3 * 3600_000) // время Москвы
  const п = (ч: number) => String(ч).padStart(2, "0")
  return (
    `${п(д.getUTCDate())}.${п(д.getUTCMonth() + 1)}.${д.getUTCFullYear()} ` +
    `${п(д.getUTCHours())}:${п(д.getUTCMinutes())}:${п(д.getUTCSeconds())}`
  )
}

// ---------- Атол ----------

let токен: { значение: string; до: number } | null = null

async function получитьТокен(заново = false): Promise<string> {
  if (!заново && токен && токен.до > Date.now()) {
    return токен.значение
  }

  const н = настройки()
  const ответ = await fetch(`${н.адрес}/getToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ login: н.логин, pass: н.пароль }),
  })
  const д: any = await ответ.json().catch(() => ({}))

  if (!д.token) {
    throw new Error(`Атол не пустил: ${д.error?.text ?? ответ.status}`)
  }

  // живёт сутки, берём с запасом
  токен = { значение: д.token, до: Date.now() + 20 * 3600_000 }
  return д.token
}

async function атол(путь: string, тело?: unknown): Promise<{ http: number; д: any }> {
  const н = настройки()

  const запрос = async (т: string) => {
    const ответ = await fetch(`${н.адрес}/${н.группа}/${путь}`, {
      method: тело ? "POST" : "GET",
      headers: { "Content-Type": "application/json; charset=utf-8", Token: т },
      body: тело ? JSON.stringify(тело) : undefined,
    })
    return { http: ответ.status, д: await ответ.json().catch(() => ({})) }
  }

  let итог = await запрос(await получитьТокен())

  // 10 — токен не распознан, 11 — истёк
  if ([10, 11].includes(итог.д?.error?.code)) {
    итог = await запрос(await получитьТокен(true))
  }

  return итог
}

// ---------- заказ ----------

async function прочитатьЗаказ(scope: MedusaContainer, id: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "order",
    filters: { id },
    // суммы просим поимённо: в «*» вычисляемых итогов нет
    fields: [
      "*",
      "total",
      "items.*",
      "items.total",
      "shipping_methods.*",
      "shipping_methods.total",
      "shipping_address.phone",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.canceled_at",
    ],
  })

  const заказ: any = data?.[0]
  if (!заказ) {
    throw new Error(`Заказ ${id} не найден`)
  }
  return заказ
}

const чекиЗаказа = (заказ: any): Чек[] => (заказ.metadata ?? {})[ЧЕКИ] ?? []

const оплаченЧерезТочку = (заказ: any) =>
  // только для проверки на тестовой кассе Атола (scratchpad), не на бою
  process.env.ATOL_LYUBAYA_OPLATA === "true" ||
  (заказ.payment_collections ?? [])
    .flatMap((к: any) => к.payments ?? [])
    .some(
      (п: any) =>
        String(п.provider_id ?? "").startsWith(ПРОВАЙДЕР_ТОЧКИ) &&
        п.captured_at &&
        !п.canceled_at
    )

/**
 * Сколько по каждой строке заказа предоплачено и ещё не закрыто — ни
 * полным расчётом, ни возвратом. Считаем по уже записанным чекам.
 */
function незакрытое(чеки: Чек[]): Map<string, Строка> {
  const итог = new Map<string, Строка>()

  for (const ч of чеки) {
    if (ч.status === "fail") {
      continue
    }
    const знак = ч.vid === "predoplata" ? 1 : -1
    for (const с of ч.stroki) {
      const было = итог.get(с.id) ?? { id: с.id, kolichestvo: 0, cena: с.cena }
      было.kolichestvo += знак * с.kolichestvo
      if (ч.vid === "predoplata") {
        было.cena = с.cena
      }
      итог.set(с.id, было)
    }
  }

  return итог
}

/** Записываем чек в заказ — свежими данными, чтобы не затереть чужое. */
async function записать(scope: MedusaContainer, idЗаказа: string, правка: (чеки: Чек[]) => Чек[]) {
  const orderModule = scope.resolve(Modules.ORDER)
  const [заказ] = await orderModule.listOrders({ id: idЗаказа }, { select: ["id", "metadata"] })
  const чеки = правка([...чекиЗаказа(заказ)])
  await orderModule.updateOrders([
    { id: idЗаказа, metadata: { ...(заказ.metadata ?? {}), [ЧЕКИ]: чеки } },
  ])
}

function чекДляАтола(
  заказ: any,
  id: string,
  позиции: Record<string, any>[]
): Record<string, any> {
  const н = настройки()
  const итого = копейки(позиции.reduce((s, п) => s + п.sum, 0))

  return {
    timestamp: сейчас(),
    external_id: id,
    receipt: {
      client: заказ.email
        ? { email: заказ.email }
        : { phone: заказ.shipping_address?.phone },
      company: { email: н.почта, sno: н.сно, inn: н.инн, payment_address: н.место },
      items: позиции,
      payments: [],
      total: итого,
    },
  }
}

const название = (с: any) =>
  [с.title ?? с.product_title, с.variant_title].filter(Boolean).join(", ").slice(0, 128)

async function поставить(scope: MedusaContainer, заказ: any, чек: Чек) {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)

  const позиции: any[] = чек.telo.receipt.items
  if (!позиции.length || позиции.some((п) => !(п.price > 0) || !(п.sum > 0))) {
    throw new Error(`чек ${чек.id} без сумм — не отправляем`)
  }
  let новый = false

  await записать(scope, заказ.id, (чеки) => {
    if (чеки.some((ч) => ч.id === чек.id)) {
      return чеки
    }
    новый = true
    return [...чеки, чек]
  })

  if (!новый) {
    return
  }

  logger.info(`Заказ ${заказ.display_id}: чек ${чек.id} записан, отправляем`)
  await отправить(scope, заказ.id, чек)
}

// ---------- три вида чеков ----------

/** «Предоплата 100 %» — после списания денег. */
export async function чекПредоплаты(scope: MedusaContainer, idЗаказа: string) {
  if (!кассаВключена()) {
    return
  }

  const заказ = await прочитатьЗаказ(scope, idЗаказа)

  if (!оплаченЧерезТочку(заказ) || чекиЗаказа(заказ).some((ч) => ч.vid === "predoplata")) {
    return
  }

  const н = настройки()
  const строки: Строка[] = []
  const позиции: Record<string, any>[] = []

  for (const с of заказ.items ?? []) {
    const штук = Number(с.quantity)
    if (!штук) {
      continue
    }
    const всего = Number(с.total)
    const цена = копейки(Number.isFinite(всего) ? всего / штук : Number(с.unit_price))
    строки.push({ id: с.id, kolichestvo: штук, cena: цена })
    позиции.push({
      name: название(с),
      price: цена,
      quantity: штук,
      measure: 0,
      sum: копейки(цена * штук),
      payment_method: "full_prepayment",
      payment_object: 1,
      vat: { type: н.ндсПредоплаты },
    })
  }

  const доставка = копейки(
    (заказ.shipping_methods ?? []).reduce((s: number, м: any) => s + (Number(м.total ?? м.amount) || 0), 0)
  )
  if (доставка > 0) {
    строки.push({ id: ДОСТАВКА, kolichestvo: 1, cena: доставка })
    позиции.push({
      name: "Доставка",
      price: доставка,
      quantity: 1,
      measure: 0,
      sum: доставка,
      payment_method: "full_prepayment",
      payment_object: 4,
      vat: { type: н.ндсПредоплаты },
    })
  }

  const id = `volento-${заказ.display_id}-predoplata`
  const тело = чекДляАтола(заказ, id, позиции)
  тело.receipt.payments = [{ type: 1, sum: тело.receipt.total }]

  if (Math.abs(тело.receipt.total - Number(заказ.total)) > 0.01) {
    scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(`Заказ ${заказ.display_id}: чек на ${тело.receipt.total}, а заказ на ${заказ.total}`)
  }

  await поставить(scope, заказ, {
    id,
    vid: "predoplata",
    operaciya: "sell",
    stroki: строки,
    telo: тело,
    status: "novyy",
    popytok: 0,
    sozdan: new Date().toISOString(),
  })
}

/**
 * «Полный расчёт» — склад собрал и прислал коды. Один чек на сборку:
 * если заказ собирали в два приёма, чеков будет два.
 */
export async function чекРасчёта(
  scope: MedusaContainer,
  idЗаказа: string,
  idСборки: string | undefined,
  собрано: { id: string; quantity: number; kody: string[] }[]
) {
  if (!кассаВключена()) {
    return
  }

  const заказ = await прочитатьЗаказ(scope, idЗаказа)
  const чеки = чекиЗаказа(заказ)

  if (!чеки.some((ч) => ч.vid === "predoplata")) {
    // предоплаты не было — значит, и денег через Точку не было
    return
  }

  const н = настройки()
  const осталось = незакрытое(чеки)
  const позиции: Record<string, any>[] = []
  const строки: Строка[] = []
  const позицииЗаказа = new Map<string, any>((заказ.items ?? []).map((с: any) => [с.id, с]))

  for (const с of собрано) {
    const цена = осталось.get(с.id)?.cena ?? копейки(Number(позицииЗаказа.get(с.id)?.unit_price ?? 0))
    строки.push({ id: с.id, kolichestvo: с.quantity, cena: цена })

    // по позиции на каждую пару: у каждой свой код
    for (const код of с.kody) {
      позиции.push({
        name: название(позицииЗаказа.get(с.id) ?? {}),
        price: цена,
        quantity: 1,
        measure: 0,
        sum: цена,
        payment_method: "full_payment",
        payment_object: 33,
        mark_processing_mode: "0",
        planned_status: 1,
        // код целиком, с разделителями GS — поэтому в Base64
        mark_code: { gs1m: Buffer.from(код, "utf8").toString("base64") },
        vat: { type: н.ндс },
      })
    }
  }

  // доставку закрываем в первом же расчёте
  const доставка = осталось.get(ДОСТАВКА)
  if (доставка && доставка.kolichestvo > 0) {
    строки.push({ id: ДОСТАВКА, kolichestvo: 1, cena: доставка.cena })
    позиции.push({
      name: "Доставка",
      price: доставка.cena,
      quantity: 1,
      measure: 0,
      sum: доставка.cena,
      payment_method: "full_payment",
      payment_object: 4,
      vat: { type: н.ндс },
    })
  }

  const id = `volento-${заказ.display_id}-raschet-${idСборки ?? чеки.length}`
  const тело = чекДляАтола(заказ, id, позиции)
  // 2 — зачёт предоплаты: деньги уже получены первым чеком
  тело.receipt.payments = [{ type: 2, sum: тело.receipt.total }]

  await поставить(scope, заказ, {
    id,
    vid: "raschet",
    operaciya: "sell",
    stroki: строки,
    telo: тело,
    status: "novyy",
    popytok: 0,
    sozdan: new Date().toISOString(),
  })
}

/**
 * «Возврат предоплаты» — за то, что не отправим.
 *
 * строки не заданы — возвращаем всё, что предоплачено и не закрыто
 * (отмена заказа). Повод входит в номер чека: «ostatok» и «otmena».
 */
export async function чекВозврата(
  scope: MedusaContainer,
  idЗаказа: string,
  повод: "ostatok" | "otmena",
  строкиВозврата?: { id: string; kolichestvo: number }[]
) {
  if (!кассаВключена()) {
    return
  }

  const заказ = await прочитатьЗаказ(scope, idЗаказа)
  const чеки = чекиЗаказа(заказ)

  if (!чеки.some((ч) => ч.vid === "predoplata")) {
    return
  }

  const н = настройки()
  const осталось = незакрытое(чеки)
  const позицииЗаказа = new Map<string, any>((заказ.items ?? []).map((с: any) => [с.id, с]))

  const что = (
    строкиВозврата ??
    [...осталось.values()].map((с) => ({ id: с.id, kolichestvo: с.kolichestvo }))
  )
    .map((с) => ({
      ...с,
      kolichestvo: Math.min(с.kolichestvo, осталось.get(с.id)?.kolichestvo ?? 0),
    }))
    .filter((с) => с.kolichestvo > 0)

  if (!что.length) {
    return
  }

  const строки: Строка[] = []
  const позиции = что.map((с) => {
    const цена = осталось.get(с.id)!.cena
    строки.push({ id: с.id, kolichestvo: с.kolichestvo, cena: цена })
    const доставка = с.id === ДОСТАВКА
    return {
      name: доставка ? "Доставка" : название(позицииЗаказа.get(с.id) ?? {}),
      price: цена,
      quantity: с.kolichestvo,
      measure: 0,
      sum: копейки(цена * с.kolichestvo),
      payment_method: "full_prepayment",
      payment_object: доставка ? 4 : 1,
      vat: { type: н.ндсПредоплаты },
    }
  })

  const id = `volento-${заказ.display_id}-vozvrat-${повод}`
  const тело = чекДляАтола(заказ, id, позиции)
  тело.receipt.payments = [{ type: 1, sum: тело.receipt.total }]

  await поставить(scope, заказ, {
    id,
    vid: "vozvrat",
    operaciya: "sell_refund",
    stroki: строки,
    telo: тело,
    status: "novyy",
    popytok: 0,
    sozdan: new Date().toISOString(),
  })
}

/** Отменили заказ, по которому уже был полный расчёт, — это возврат вещей. */
export async function расчётБылЛи(scope: MedusaContainer, idЗаказа: string) {
  const заказ = await прочитатьЗаказ(scope, idЗаказа)
  return {
    заказ,
    был: чекиЗаказа(заказ).some((ч) => ч.vid === "raschet" && ч.status !== "fail"),
  }
}

// ---------- отправка и результат ----------

async function отметить(scope: MedusaContainer, idЗаказа: string, idЧека: string, поля: Partial<Чек>) {
  await записать(scope, idЗаказа, (чеки) =>
    чеки.map((ч) => (ч.id === idЧека ? { ...ч, ...поля } : ч))
  )
}

async function провал(scope: MedusaContainer, заказ: { id: string; display_id?: number }, чек: Чек, текст: string) {
  await отметить(scope, заказ.id, чек.id, { status: "fail", oshibka: текст })
  await позвать(scope, {
    тема: `Чек не пробился: заказ ${заказ.display_id ?? заказ.id}`,
    текст:
      `Касса Атол отказала в чеке ${чек.id}: ${текст}\n\n` +
      `Покупатель без чека — пробейте его в кабинете Атола или напишите мне.`,
  })
}

// ---------- коды и «Честный знак» ----------

type Позиция = Record<string, any>

const позиции = (тело: Record<string, any>): Позиция[] => тело?.receipt?.items ?? []

const кодПозиции = (п: Позиция): string | null =>
  п.mark_code?.gs1m ? Buffer.from(п.mark_code.gs1m, "base64").toString("utf8") : null

/** В чеке есть коды, а факта проверки при них ещё нет. */
const нужнаПроверка = (тело: Record<string, any>) =>
  позиции(тело).some((п) => кодПозиции(п) && !п.sectoral_item_props?.length)

/** Тело с фактом и временем проверки при каждом коде (тег 1260). */
export function телоСПроверкой(тело: Record<string, any>, итог: ИтогПроверки): Record<string, any> {
  if (итог.вид !== "можно") {
    return тело
  }
  const поКоду = new Map(итог.коды.map((к) => [к.код, к]))

  return {
    ...тело,
    receipt: {
      ...тело.receipt,
      items: позиции(тело).map((п) => {
        const к = поКоду.get(кодПозиции(п) ?? "")
        return к ? { ...п, sectoral_item_props: [отраслевойРеквизит(к.reqId, к.reqTimestamp)] } : п
      }),
    },
  }
}

const сводка = (итог: ИтогПроверки): Чек["proverka"] => ({
  kogda: new Date().toISOString(),
  ...(итог.вид === "авария" ? { avariya: true } : {}),
  ...("коды" in итог
    ? {
        kody: итог.коды.map((к) => ({
          vidimyy: к.видимый,
          reqId: к.reqId,
          reqTimestamp: к.reqTimestamp,
          zapret: к.запрет,
        })),
      }
    : {}),
})

/**
 * Флаги ТС ПИоТ ставим по переключателю в момент отправки, а не при
 * записи чека: так чеки из очереди уйдут уже по новой схеме.
 */
function дляОтправки(тело: Record<string, any>): Record<string, any> {
  const итог = { ...тело }
  delete итог.use_tspiot
  delete итог.permissive_mode
  return режимПроверки() === "tspiot" ? { ...итог, use_tspiot: true, permissive_mode: true } : итог
}

/**
 * Проверка кодов нашими силами (режим chz). true — можно отправлять
 * (тело в заказе уже с реквизитом), false — нельзя или пока некуда.
 */
async function проверитьПередОтправкой(
  scope: MedusaContainer,
  idЗаказа: string,
  чек: Чек
): Promise<Record<string, any> | null> {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
  const коды = позиции(чек.telo).map(кодПозиции).filter((к): к is string => Boolean(к))
  const итог = await проверитьКоды(коды)

  if (итог.вид === "недоступен") {
    // сторож чеков спросит ещё раз через пять минут, через час позовёт
    await отметить(scope, idЗаказа, чек.id, {
      popytok: чек.popytok + 1,
      oshibka: `Честный знак: ${итог.причина}`,
    })
    const текст = `Чек ${чек.id} ждёт проверки кодов в ЧЗ: ${итог.причина}`
    итог.токен ? logger.error(текст) : logger.warn(текст)
    return null
  }

  if (итог.вид === "нельзя") {
    await отметить(scope, idЗаказа, чек.id, { proverka: сводка(итог) })
    const причины = итог.коды
      .filter((к) => к.запрет)
      .map((к) => `${к.видимый} — ${к.запрет}`)
      .join("; ")
    logger.warn(`Чек ${чек.id}: ЧЗ запретил продажу: ${причины}`)
    await провал(scope, { id: idЗаказа }, чек, `Честный знак запретил продажу: ${причины}`)
    return null
  }

  if (итог.вид === "авария") {
    // в аварийном режиме ЧЗ продаём без проверки, тег 1260 не заполняем
    // (методические рекомендации, раздел 7)
    logger.warn(`Чек ${чек.id}: в ЧЗ аварийный режим, бьём без проверки кодов`)
  } else {
    logger.info(
      `Чек ${чек.id}: коды проверены в ЧЗ (${итог.коды.map((к) => видимаяЧасть(к.код)).join(", ")})`
    )
  }

  const тело = телоСПроверкой(чек.telo, итог)
  // запоминаем с реквизитом: если Атол сейчас не ответит, повтор уйдёт с
  // этой же проверкой, а не с новой — вдруг первый чек всё-таки прошёл
  await отметить(scope, idЗаказа, чек.id, { telo: тело, proverka: сводка(итог) })
  return тело
}

export async function отправить(scope: MedusaContainer, idЗаказа: string, чек: Чек) {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
  const номер = чек.id
  let тело = чек.telo

  if (
    чек.operaciya === "sell" &&
    режимПроверки() === "chz" &&
    !чек.proverka?.avariya &&
    нужнаПроверка(тело)
  ) {
    const проверенное = await проверитьПередОтправкой(scope, idЗаказа, чек)
    if (!проверенное) {
      return
    }
    тело = проверенное
  }

  try {
    const { http, д } = await атол(чек.operaciya, { ...дляОтправки(тело), timestamp: сейчас() })
    const код = д?.error?.code

    if (д?.uuid && !д.error) {
      await отметить(scope, idЗаказа, номер, { status: "wait", uuid: д.uuid, popytok: чек.popytok + 1 })
      logger.info(`Чек ${номер} принят Атолом`)
      return
    }

    if (код === 33 && д?.uuid) {
      // уже отправляли — просто запоминаем номер
      await отметить(scope, idЗаказа, номер, { status: "wait", uuid: д.uuid })
      return
    }

    if (http >= 500 || !код) {
      throw new Error(`Атол ответил ${http}`)
    }

    await провал(scope, { id: idЗаказа }, чек, `${д.error.text} (код ${код})`)
  } catch (ошибка: any) {
    // сеть или сбой Атола — сторож попробует ещё
    await отметить(scope, idЗаказа, номер, { popytok: чек.popytok + 1, oshibka: ошибка?.message })
    logger.warn(`Чек ${номер} не отправлен: ${ошибка?.message}`)
  }
}

export async function узнатьРезультат(scope: MedusaContainer, заказ: any, чек: Чек) {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
  const { д } = await атол(`report/${чек.uuid}`)

  if (д?.status === "done") {
    await отметить(scope, заказ.id, чек.id, {
      status: "done",
      ssylka: д.payload?.ofd_receipt_url,
      oshibka: undefined,
    })
    logger.info(`Чек ${чек.id} пробит`)
    return
  }

  if (д?.status === "fail") {
    const причины = (д.error?.permissive_mode_result ?? [])
      .map((р: any) => JSON.stringify(р))
      .join("; ")
    await провал(scope, заказ, чек, [д.error?.text, причины].filter(Boolean).join(" — "))
  }
}

/** Все заказы с чеками, которые ещё не дошли до конца. */
export async function незаконченныеЧеки(scope: MedusaContainer) {
  const orderModule = scope.resolve(Modules.ORDER)
  const с = new Date(Date.now() - 45 * 24 * 3600_000)

  const заказы = await orderModule.listOrders(
    { updated_at: { $gte: с } } as any,
    { select: ["id", "display_id", "metadata"], take: 2000 }
  )

  return заказы
    .map((з: any) => ({
      заказ: з,
      чеки: чекиЗаказа(з).filter((ч) => ч.status === "novyy" || ч.status === "wait"),
    }))
    .filter((р) => р.чеки.length)
}
