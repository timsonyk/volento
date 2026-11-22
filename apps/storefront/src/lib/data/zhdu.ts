"use server"

import { retrieveCustomer, updateCustomer } from "./customer"

type Ожидание = { v: string; t: string }

/**
 * ОБРАЗЕЦ «Сообщить, когда появится». Покупатель выбрал размер, которого
 * нет, и просит написать ему, когда тот появится.
 *
 * Просьбы лежат у покупателя в metadata.zhdu, отдельной таблицы нет.
 * Само письмо пока не отправляется: это следующий шаг, если образец
 * понравится.
 */
export async function ждатьРазмер(
  variantId: string
): Promise<{ итог: "записали"; почта: string } | { итог: "нужен-вход" } | { итог: "сбой" }> {
  if (!/^variant_[A-Za-z0-9]+$/.test(variantId)) return { итог: "сбой" }
  const покупатель = await retrieveCustomer()
  if (!покупатель) return { итог: "нужен-вход" }

  const было = Array.isArray(покупатель.metadata?.zhdu)
    ? (покупатель.metadata!.zhdu as Ожидание[])
    : []
  const стало = [
    ...было.filter((о) => о?.v && о.v !== variantId),
    { v: variantId, t: new Date().toISOString() },
  ].slice(-30)

  try {
    await updateCustomer({ metadata: { ...(покупатель.metadata ?? {}), zhdu: стало } })
    return { итог: "записали", почта: покупатель.email }
  } catch {
    return { итог: "сбой" }
  }
}
