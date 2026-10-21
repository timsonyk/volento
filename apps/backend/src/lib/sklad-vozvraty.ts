import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { type ИтогСборки, записатьИтог, итогиЗаказа } from "./dostavka-itog"
import { этоТест } from "./sklad-test-metka"
import { позвать } from "./trevoga"

/**
 * Возвраты невыкупленного на склад: что едет обратно и что склад принял.
 *
 * Невыкупленные пары не проданы — их коды не попали в чек и остаются
 * за нами. Склад принимает посылку, сканирует коды и шлёт их нам. Если
 * пришла не та пара, что мы ждали (служба не сказала, какая из
 * одинаковых вернулась, и мы угадали неверно), зовём человека: в чеке
 * продан не тот код, его надо поправить.
 */
const СТРАНИЦА = 500

/** Заказы, в итоге выдачи которых есть непринятый возврат. */
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
      const ждём = Object.values(итогиЗаказа(з)).some((и) => и.nevykupleno?.length && !и.prinyat)
      if (ждём) иды.push(з.id)
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
    return Object.entries(итогиЗаказа(з))
      .filter(([, и]) => и.nevykupleno?.length && !и.prinyat)
      .map(([idСборки, и]) => {
        const сборка = (з.fulfillments ?? []).find((с: any) => с.id === idСборки)
        return {
          nomer: String(з.display_id),
          perevozchik: сборка?.data?.test
            ? "test"
            : (з.shipping_methods ?? [])[0]?.data?.apishipData?.tariff?.providerKey ?? null,
          trek: (сборка?.labels ?? []).find((м: any) => м.tracking_number)?.tracking_number ?? null,
          kogda_vydan: и.kogda,
          pozicii: и.nevykupleno.map((с) => ({
            artikul: строки.get(с.id)?.variant_sku ?? null,
            nazvanie: [строки.get(с.id)?.title, строки.get(с.id)?.variant_title].filter(Boolean).join(", "),
            kolichestvo: с.shtuk,
            kody: с.kody,
          })),
        }
      })
  })
}

export type ИтогПриёма = {
  sostoyanie: "vozvrat_prinyat" | "uzhe_prinyat"
  sovpalo: boolean
  ne_zhdali: string[]
  ne_prishli: string[]
}

/** Склад принял возврат по заказу: сверяем коды с ожидаемыми. */
export async function принятьВозврат(scope: MedusaContainer, заказ: any, прислали: string[]): Promise<ИтогПриёма | null> {
  const итоги = Object.entries(итогиЗаказа(заказ)).filter(([, и]) => и.nevykupleno?.length)

  if (!итоги.length) {
    return null
  }

  const ждём = итоги.filter(([, и]) => !и.prinyat)
  if (!ждём.length) {
    return { sostoyanie: "uzhe_prinyat", sovpalo: итоги.every(([, и]) => и.prinyat?.sovpalo), ne_zhdali: [], ne_prishli: [] }
  }

  const ожидали = new Set(ждём.flatMap(([, и]) => и.nevykupleno.flatMap((с) => с.kody)))
  const пришли = new Set(прислали.map((к) => String(к).trim()).filter(Boolean))
  const ne_zhdali = [...пришли].filter((к) => !ожидали.has(к))
  const ne_prishli = [...ожидали].filter((к) => !пришли.has(к))
  const sovpalo = !ne_zhdali.length && !ne_prishli.length

  for (const [idСборки] of ждём) {
    await записатьИтог(scope, заказ.id, idСборки, {
      prinyat: { kogda: new Date().toISOString(), kody: [...пришли], sovpalo },
    } as Partial<ИтогСборки>)
  }

  if (!sovpalo && !этоТест(заказ)) {
    const коротко = (к: string) => к.split("\u001d")[0]
    await позвать(scope, {
      тема: `Заказ ${заказ.display_id}: на склад вернулась не та пара`,
      текст:
        `Ждали коды:\n${ne_prishli.map(коротко).join("\n") || "—"}\n\n` +
        `Пришли коды, которых не ждали:\n${ne_zhdali.map(коротко).join("\n") || "—"}\n\n` +
        `Значит, в чеке «полный расчёт» продан не тот код. Напишите мне — поправим чеками ` +
        `возврата и продажи, иначе вернувшуюся пару не продать.`,
    })
  }

  return { sostoyanie: "vozvrat_prinyat", sovpalo, ne_zhdali, ne_prishli }
}
