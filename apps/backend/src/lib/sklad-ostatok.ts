import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  beginOrderEditOrderWorkflow,
  cancelBeginOrderEditWorkflow,
  cancelOrderWorkflow,
  confirmOrderEditRequestWorkflow,
  orderEditUpdateItemQuantityWorkflow,
  refundPaymentWorkflow,
  requestOrderEditRequestWorkflow,
} from "@medusajs/medusa/core-flows"

import { НЕХВАТКА, type СтрокаСборки, завестиСборку } from "./sklad-sborka"

/**
 * Решение по заказу, который склад собрал не полностью, — после звонка
 * покупателю.
 *
 * «Отправить остаток»: убираем из заказа то, чего нет, возвращаем за
 * это деньги и заводим сборку на собранное — с кодами, которые склад
 * уже прислал. Складу второй раз ничего слать не нужно: заказ сам
 * появится у него в /sklad/k-upakovke.
 *
 * Шагов три, и каждый отмечаем в заказе. Если что-то упало посередине,
 * повторное нажатие продолжит с того же места — иначе заказ урезали бы
 * дважды или вернули бы деньги дважды.
 *
 * «Отменить»: обычная отмена — Medusa сама снимет резерв и вернёт деньги.
 */
type Нехватка = {
  kogda: string
  sobrano: СтрокаСборки[]
  ne_hvataet: { id_stroki: string; kolichestvo: number }[]
  etap?: "zakaz_izmenen" | "dengi_vozvrascheny"
}

async function прочитатьЗаказ(scope: MedusaContainer, id: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "order",
    filters: { id },
    fields: [
      "id",
      "display_id",
      "status",
      "metadata",
      "items.id",
      "items.detail.quantity",
      "summary.*",
      "payment_collections.payments.id",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.canceled_at",
    ],
  })

  const заказ: any = data?.[0]

  if (!заказ) {
    throw new Error("Заказ не найден")
  }

  return заказ
}

const отметить = async (scope: MedusaContainer, заказ: any, нехватка: Нехватка) => {
  await scope.resolve(Modules.ORDER).updateOrders([
    { id: заказ.id, metadata: { ...(заказ.metadata ?? {}), [НЕХВАТКА]: нехватка } },
  ])
  заказ.metadata = { ...(заказ.metadata ?? {}), [НЕХВАТКА]: нехватка }
}

export async function отправитьОстаток(
  scope: MedusaContainer,
  idЗаказа: string,
  кто: string | undefined
) {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
  const заказ = await прочитатьЗаказ(scope, idЗаказа)
  const нехватка: Нехватка | null = (заказ.metadata ?? {})[НЕХВАТКА] ?? null

  if (!нехватка) {
    throw new Error("По этому заказу склад ничего не ждёт")
  }

  if (заказ.status === "canceled") {
    throw new Error("Заказ уже отменён")
  }

  // 1. Убираем из заказа то, чего нет на складе
  if (!нехватка.etap) {
    const сколькоБыло = new Map<string, number>(
      (заказ.items ?? []).map((т: any) => [т.id, Number(т.detail?.quantity ?? 0)])
    )

    try {
      await beginOrderEditOrderWorkflow(scope).run({
        input: {
          order_id: заказ.id,
          created_by: кто,
          description: "Склад собрал не всё — покупатель согласился на остаток",
        },
      })
    } catch {
      // Правка осталась от прошлой неудачной попытки — начинаем заново
      await cancelBeginOrderEditWorkflow(scope).run({ input: { order_id: заказ.id } })
      await beginOrderEditOrderWorkflow(scope).run({
        input: { order_id: заказ.id, created_by: кто },
      })
    }

    await orderEditUpdateItemQuantityWorkflow(scope).run({
      input: {
        order_id: заказ.id,
        items: нехватка.ne_hvataet.map((н) => ({
          id: н.id_stroki,
          quantity: Math.max(0, (сколькоБыло.get(н.id_stroki) ?? 0) - н.kolichestvo),
        })),
      },
    })
    await requestOrderEditRequestWorkflow(scope).run({
      input: { order_id: заказ.id, requested_by: кто },
    })
    await confirmOrderEditRequestWorkflow(scope).run({
      input: { order_id: заказ.id, confirmed_by: кто as string },
    })

    await отметить(scope, заказ, { ...нехватка, etap: "zakaz_izmenen" })
    logger.info(`Заказ ${заказ.display_id}: убрали то, чего нет на складе`)
  }

  // 2. Возвращаем деньги за убранное. Сумму берём у Medusa: после правки
  // заказ стоит меньше, чем заплачено, — разницу она и считает.
  if (заказ.metadata[НЕХВАТКА].etap === "zakaz_izmenen") {
    const свежий = await прочитатьЗаказ(scope, заказ.id)
    const переплата = -Number(свежий.summary?.pending_difference ?? 0)

    if (переплата > 0) {
      const платёж = (свежий.payment_collections ?? [])
        .flatMap((к: any) => к.payments ?? [])
        .find((п: any) => п.captured_at && !п.canceled_at)

      if (!платёж) {
        throw new Error("Не нашли списанный платёж — верните деньги вручную в админке")
      }

      await refundPaymentWorkflow(scope).run({
        input: {
          payment_id: платёж.id,
          amount: переплата,
          created_by: кто,
          note: "Склад собрал не всё",
        },
      })
      logger.info(`Заказ ${заказ.display_id}: вернули ${переплата} ₽ за недостающее`)
    }

    await отметить(scope, заказ, { ...заказ.metadata[НЕХВАТКА], etap: "dengi_vozvrascheny" })
  }

  // 3. Сборка на то, что собрано. Нехватку сборка закрывает сама.
  return завестиСборку(scope, заказ, заказ.metadata[НЕХВАТКА].sobrano)
}

export async function отменитьЗаказ(
  scope: MedusaContainer,
  idЗаказа: string,
  кто: string | undefined
) {
  const заказ = await прочитатьЗаказ(scope, idЗаказа)

  if ((заказ.metadata ?? {})[НЕХВАТКА]?.etap) {
    // Заказ уже урезан и часть денег вернули — отмена вернёт остальное,
    // но такой случай лучше видеть глазами.
    scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(`Заказ ${заказ.display_id} отменяют после частичного возврата`)
  }

  await cancelOrderWorkflow(scope).run({
    input: { order_id: заказ.id, canceled_by: кто } as any,
  })
}
