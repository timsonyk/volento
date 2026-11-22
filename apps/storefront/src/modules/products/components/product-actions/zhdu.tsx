"use client"

import { ждатьРазмер } from "@lib/data/zhdu"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useEffect, useState } from "react"

/**
 * «Сообщить, когда появится»: покупатель выбрал размер, которого нет.
 * Просьбу записывает lib/data/zhdu.ts, письмо шлёт бэкенд
 * (lib/postuplenie.ts), когда размер появится.
 */
export default function СообщитьОПоступлении({ variantId }: { variantId: string }) {
  const [идёт, setИдёт] = useState(false)
  const [итог, setИтог] = useState<
    null | { вид: "записали"; почта: string } | { вид: "нужен-вход" } | { вид: "сбой" }
  >(null)

  // другой размер: прошлый ответ к нему не относится
  useEffect(() => setИтог(null), [variantId])

  const нажали = async () => {
    setИдёт(true)
    try {
      const ответ = await ждатьРазмер(variantId)
      setИтог(
        ответ.итог === "записали"
          ? { вид: "записали", почта: ответ.почта }
          : { вид: ответ.итог }
      )
    } catch {
      setИтог({ вид: "сбой" })
    } finally {
      setИдёт(false)
    }
  }

  return (
    <div className="border border-rule p-4 text-sm text-ink" data-testid="zhdu">
      {итог?.вид === "записали" ? (
        <p data-testid="zhdu-zapisali" role="status">
          Запомнили. Напишем на {итог.почта}, когда этот размер появится.
        </p>
      ) : итог?.вид === "нужен-вход" ? (
        <p data-testid="zhdu-vhod">
          <LocalizedClientLink href="/account" className="underline underline-offset-4">
            Войдите
          </LocalizedClientLink>
          , и мы напишем вам, когда этот размер появится.
        </p>
      ) : (
        <>
          <p className="text-muted">Этого размера сейчас нет.</p>
          <button
            type="button"
            onClick={нажали}
            disabled={идёт}
            className="mt-2 underline underline-offset-4 disabled:opacity-50"
            data-testid="zhdu-knopka"
          >
            {идёт ? "Записываем" : "Сообщить, когда появится"}
          </button>
          {итог?.вид === "сбой" && (
            <p className="mt-2 text-red-600" role="alert">
              Не получилось записать. Попробуйте ещё раз
            </p>
          )}
        </>
      )}
    </div>
  )
}
