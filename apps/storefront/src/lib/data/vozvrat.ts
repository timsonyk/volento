"use server"

import { revalidateTag } from "next/cache"

import { sdk } from "@lib/config"
import { getAuthHeaders, getCacheTag } from "./cookies"

/**
 * Возврат через кабинет: что можно вернуть и подача заявки
 * (backend/src/api/store/vozvrat). Ответ сервера — как есть: латинские
 * поля, чтобы не переводить туда-обратно.
 */
export type СведенияВозврата = {
  do: string | null
  pary: { id_stroki: string; kod: string; nazvanie: string; artikul: string | null }[]
  prichiny: string[]
  instrukciya: string
  zayavki: {
    nomer: string
    sozdana: string
    status: "zhdem" | "prinyat" | "chastichno" | "otklonen"
    shtuk: number
    vernuli: number | null
    otkloneno: number
  }[]
}

export async function сведенияВозврата(idЗаказа: string): Promise<СведенияВозврата | null> {
  return sdk.client
    .fetch<СведенияВозврата>(`/store/vozvrat/${idЗаказа}`, {
      method: "GET",
      headers: { ...(await getAuthHeaders()) },
      cache: "no-store",
    })
    .catch(() => null)
}

export async function оформитьВозврат(
  idЗаказа: string,
  kody: string[],
  prichina?: string,
  kommentariy?: string
): Promise<{ ok: true; nomer: string; сведения: СведенияВозврата } | { ok: false; ошибка: string }> {
  try {
    const ответ = await sdk.client.fetch<СведенияВозврата & { nomer: string }>(`/store/vozvrat/${idЗаказа}`, {
      method: "POST",
      headers: { ...(await getAuthHeaders()) },
      body: { kody, prichina, kommentariy },
    })
    revalidateTag(await getCacheTag("orders"))
    return { ok: true, nomer: ответ.nomer, сведения: ответ }
  } catch (e) {
    return { ok: false, ошибка: (e as Error)?.message || "Не получилось оформить возврат" }
  }
}
