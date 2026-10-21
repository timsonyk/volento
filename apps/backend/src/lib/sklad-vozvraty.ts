import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { type ИтогСборки, записатьИтог, итогиЗаказа } from "./dostavka-itog"
import { этоТест } from "./sklad-test-metka"
import { позвать } from "./trevoga"
import { type ИтогПриёмаЗаявки, заявкиЗаказа, принятьЗаявки } from "./vozvrat-pokupatelya"

/**
 * Возвраты на склад: что едет обратно и что склад принял. Два вида:
 * невыкуп (покупатель не забрал в пункте выдачи) и возврат покупателя
 * (оформил в кабинете — lib/vozvrat-pokupatelya.ts). Принимает склад одной
 * ручкой, разбираем по кодам.
 *
 * Невыкупленные пары не проданы — их коды не попали в чек и остаются
 * за нами. Склад принимает посылку, сканирует коды и шлёт их нам. Если
 * пришла не та пара, что мы ждали (служба не сказала, какая из
 * одинаковых вернулась, и мы угадали неверно), зовём человека: в чеке
 * продан не тот код, его надо поправить.
 */
const СТРАНИЦА = 500

const ждётНевыкуп = (з: any) => Object.values(итогиЗаказа(з)).some((и) => и.nevykupleno?.length && !и.prinyat)
const ждётЗаявку = (з: any) => заявкиЗаказа(з).some((з2) => з2.status === "zhdem")

/** Заказы, по которым ждём посылку: невыкуп или заявку покупателя. */
async function заказыСВозвратом(scope: MedusaContainer) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const иды: string[] = []

  for (let skip = 0; ; skip += СТРАНИЦА) {
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      pagination: { order: { created_at: "ASC" }, skip, take: СТРАНИЦА } as any,
    })
    for (const з of data ?? []) {
      if (ждётНевыкуп(з) || ждётЗаявку(з)) иды.push(з.id)
    }
    if ((data ?? []).length < СТРАНИЦА) break
  }

  if (!иды.length) {
    return []
  }

  const { data } = await query.graph({
    entity: "order",
    filters: { id: иды },
    fields: [
      "id",
      "display_id",
      "metadata",
      "items.id",
      "items.title",
      "items.variant_title",
      "items.variant_sku",
      "fulfillments.id",
      "fulfillments.data",
      "fulfillments.labels.tracking_number",
      "shipping_methods.data",
    ],
  })
  return data ?? []
}

export async function ожидаемыеВозвраты(scope: MedusaContainer, тест: boolean) {
  const заказы = (await заказыСВозвратом(scope)).filter((з: any) => этоТест(з) === тест)

  return заказы.flatMap((з: any) => {
    const строки = new Map<string, any>((з.items ?? []).map((с: any) => [с.id, с]))
    const позиция = (id: string, kody: string[], kolichestvo = kody.length) => ({
      artikul: строки.get(id)?.variant_sku ?? null,
      nazvanie: [строки.get(id)?.title, строки.get(id)?.variant_title].filter(Boolean).join(", "),
      kolichestvo,
      kody,
    })

    const заявки = заявкиЗаказа(з)
      .filter((з2) => з2.status === "zhdem")
      .map((з2) => ({
        nomer: String(з.display_id),
        vid: "pokupatel",
        zayavka: з2.nomer,
        sozdana: з2.sozdana,
        pozicii: з2.pary.map((п) => позиция(п.id_stroki, [п.kod])),
      }))

    return [...заявки, ...Object.entries(итогиЗаказа(з))
      .filter(([, и]) => и.nevykupleno?.length && !и.prinyat)
      .map(([idСборки, и]) => {
        const сборка = (з.fulfillments ?? []).find((с: any) => с.id === idСборки)
        return {
          nomer: String(з.display_id),
          vid: "nevykup",
          perevozchik: сборка?.data?.test
            ? "test"
            : (з.shipping_methods ?? [])[0]?.data?.apishipData?.tariff?.providerKey ?? null,
          trek: (сборка?.labels ?? []).find((м: any) => м.tracking_number)?.tracking_number ?? null,
          kogda_vydan: и.kogda,
          pozicii: и.nevykupleno.map((с) => позиция(с.id, с.kody, с.shtuk)),
        }
      })]
  })
}

export type ИтогПриёма = {
  sostoyanie: "vozvrat_prinyat" | "uzhe_prinyat"
  sovpalo: boolean
  ne_zhdali: string[]
  ne_prishli: string[]
  zayavki: ИтогПриёмаЗаявки[]
}

/**
 * Склад принял посылку по заказу: сверяем коды с ожидаемыми.
 *
 * Коды невыкупа закрывают невыкуп, коды из заявок покупателя — заявки (и
 * возвращают за них деньги). otkloneno — пары из заявок, которые склад не
 * принял (носили, нет ярлыков): за них деньги не возвращаем.
 */
export async function принятьВозврат(
  scope: MedusaContainer,
  заказ: any,
  прислали: string[],
  otkloneno: { kod: string; prichina: string }[] = []
): Promise<ИтогПриёма | null> {
  const итоги = Object.entries(итогиЗаказа(заказ)).filter(([, и]) => и.nevykupleno?.length)
  const заявки = заявкиЗаказа(заказ)

  if (!итоги.length && !заявки.length) {
    return null
  }

  const ждёмНевыкуп = итоги.filter(([, и]) => !и.prinyat)
  const ждёмЗаявки = заявки.filter((з) => з.status === "zhdem")

  if (!ждёмНевыкуп.length && !ждёмЗаявки.length) {
    return {
      sostoyanie: "uzhe_prinyat",
      sovpalo: итоги.every(([, и]) => и.prinyat?.sovpalo !== false),
      ne_zhdali: [],
      ne_prishli: [],
      zayavki: [],
    }
  }

  const пришли = new Set(прислали.map((к) => String(к).trim()).filter(Boolean))
  const кодыНевыкупа = new Set(ждёмНевыкуп.flatMap(([, и]) => и.nevykupleno.flatMap((с) => с.kody)))
  const кодыЗаявок = new Set(ждёмЗаявки.flatMap((з) => з.pary.map((п) => п.kod)))
  const ne_zhdali = [...пришли].filter((к) => !кодыНевыкупа.has(к) && !кодыЗаявок.has(к))

  // Невыкуп закрываем, если пришло хоть что-то из него — или если заявок
  // покупателя нет и сравнивать больше не с чем (пришла не та пара).
  const ne_prishli: string[] = []
  const закрытьНевыкуп = ждёмНевыкуп.length && ([...пришли].some((к) => кодыНевыкупа.has(к)) || !ждёмЗаявки.length)
  if (закрытьНевыкуп) {
    const нетНевыкупа = [...кодыНевыкупа].filter((к) => !пришли.has(к))
    ne_prishli.push(...нетНевыкупа)
    for (const [idСборки] of ждёмНевыкуп) {
      await записатьИтог(scope, заказ.id, idСборки, {
        prinyat: { kogda: new Date().toISOString(), kody: [...пришли], sovpalo: !нетНевыкупа.length && !ne_zhdali.length },
      } as Partial<ИтогСборки>)
    }
  }

  // Заявки покупателя: закрываем те, из которых пришло хоть что-то
  const поЗаявкам = await принятьЗаявки(scope, заказ.id, [...пришли], otkloneno)
  for (const з of ждёмЗаявки.filter((з2) => поЗаявкам.some((и) => и.nomer === з2.nomer))) {
    ne_prishli.push(...з.pary.map((п) => п.kod).filter((к) => !пришли.has(к)))
  }

  const sovpalo = !ne_zhdali.length && !ne_prishli.length

  if (!sovpalo && !этоТест(заказ)) {
    const коротко = (к: string) => к.split("\u001d")[0]
    await позвать(scope, {
      тема: `Заказ ${заказ.display_id}: на склад вернулось не то, что ждали`,
      текст:
        `Ждали, но не пришли:\n${ne_prishli.map(коротко).join("\n") || "—"}\n\n` +
        `Пришли коды, которых не ждали:\n${ne_zhdali.map(коротко).join("\n") || "—"}\n\n` +
        `Если это невыкуп — в чеке «полный расчёт» продан не тот код, его надо поправить чеками ` +
        `возврата и продажи, иначе вернувшуюся пару не продать. Напишите мне.`,
    })
  }

  return { sostoyanie: "vozvrat_prinyat", sovpalo, ne_zhdali, ne_prishli, zayavki: поЗаявкам }
}
