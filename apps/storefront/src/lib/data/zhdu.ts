"use server"

import { retrieveCustomer, updateCustomer } from "./customer"

/** v: id размера, t: когда попросили, n: название с размером, h: адрес товара */
type Ожидание = { v: string; t: string; n?: string; h?: string }

const ПОХОЖЕ_НА_ID = /^variant_[A-Za-z0-9]+$/
const ПОХОЖЕ_НА_АДРЕС = /^[a-z0-9-]{1,200}$/

const просьбы = (metadata: unknown): Ожидание[] => {
  const сырые = (metadata as any)?.zhdu
  return Array.isArray(сырые) ? сырые.filter((о) => о && typeof о.v === "string") : []
}

/**
 * «Сообщить, когда появится». Покупатель выбрал размер, которого нет, и
 * просит написать ему, когда тот появится.
 *
 * Просьбы лежат у покупателя в metadata.zhdu, отдельной таблицы нет.
 * Письмо шлёт бэкенд (lib/postuplenie.ts, раз в четверть часа) и после
 * этого просьбу снимает. Название и адрес товара кладём рядом, чтобы
 * показать список в кабинете без лишних запросов.
 */
export async function ждатьРазмер(
  variantId: string,
  название?: string,
  адрес?: string
): Promise<{ итог: "записали"; почта: string } | { итог: "нужен-вход" } | { итог: "сбой" }> {
  if (!ПОХОЖЕ_НА_ID.test(variantId)) return { итог: "сбой" }
  const покупатель = await retrieveCustomer()
  if (!покупатель) return { итог: "нужен-вход" }

  const новая: Ожидание = { v: variantId, t: new Date().toISOString() }
  if (typeof название === "string" && название.trim()) новая.n = название.trim().slice(0, 160)
  if (typeof адрес === "string" && ПОХОЖЕ_НА_АДРЕС.test(адрес)) новая.h = адрес

  const стало = [
    ...просьбы(покупатель.metadata).filter((о) => о.v !== variantId),
    новая,
  ].slice(-30)

  try {
    await updateCustomer({ metadata: { ...(покупатель.metadata ?? {}), zhdu: стало } })
    return { итог: "записали", почта: покупатель.email }
  } catch {
    return { итог: "сбой" }
  }
}

/** Покупатель передумал ждать размер. */
export async function неЖдатьРазмер(variantId: string): Promise<{ готово: boolean }> {
  if (!ПОХОЖЕ_НА_ID.test(variantId)) return { готово: false }
  const покупатель = await retrieveCustomer()
  if (!покупатель) return { готово: false }

  try {
    await updateCustomer({
      metadata: {
        ...(покупатель.metadata ?? {}),
        zhdu: просьбы(покупатель.metadata).filter((о) => о.v !== variantId),
      },
    })
    return { готово: true }
  } catch {
    return { готово: false }
  }
}
