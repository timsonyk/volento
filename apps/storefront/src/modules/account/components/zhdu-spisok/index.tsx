"use client"

import { неЖдатьРазмер } from "@lib/data/zhdu"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useRouter } from "next/navigation"
import { useState } from "react"

export type Просьба = { v: string; n?: string; h?: string }

/**
 * Кабинет: размеры, о поступлении которых покупатель просил сообщить.
 * Пустой список не показываем вовсе. Просьбу можно снять.
 */
export default function ЖдуПоступления({ просьбы }: { просьбы: Просьба[] }) {
  const router = useRouter()
  const [убраны, setУбраны] = useState<string[]>([])
  const [идёт, setИдёт] = useState<string | null>(null)
  const [сбой, setСбой] = useState(false)

  const видимые = просьбы.filter((п) => !убраны.includes(п.v))
  if (!видимые.length) return null

  const убрать = async (v: string) => {
    setИдёт(v)
    setСбой(false)
    try {
      const { готово } = await неЖдатьРазмер(v)
      if (готово) {
        setУбраны((было) => [...было, v])
        router.refresh()
      } else setСбой(true)
    } catch {
      setСбой(true)
    } finally {
      setИдёт(null)
    }
  }

  return (
    <div className="text-small-regular" data-testid="zhdu-spisok">
      <span className="uppercase text-ui-fg-base">Жду поступления</span>
      <p className="mt-2 text-ui-fg-subtle">
        Напишем на почту, когда размер появится.
      </p>
      <ul className="mt-3 flex flex-col gap-y-3">
        {видимые.map((п) => (
          <li key={п.v} className="flex items-start justify-between gap-x-4" data-testid="zhdu-stroka">
            {п.h ? (
              <LocalizedClientLink
                href={`/products/${п.h}?v_id=${п.v}`}
                className="min-w-0 break-words font-semibold underline underline-offset-4"
              >
                {п.n || "Открыть товар"}
              </LocalizedClientLink>
            ) : (
              <span className="min-w-0 break-words font-semibold">{п.n || "Размер без названия"}</span>
            )}
            <button
              type="button"
              onClick={() => убрать(п.v)}
              disabled={идёт === п.v}
              className="shrink-0 text-ui-fg-subtle underline underline-offset-4 disabled:opacity-50"
              data-testid="zhdu-ubrat"
              aria-label={`Не ждать: ${п.n || "размер"}`}
            >
              Не ждать
            </button>
          </li>
        ))}
      </ul>
      {сбой && (
        <p className="mt-2 text-red-600" role="alert">
          Не получилось убрать. Попробуйте ещё раз
        </p>
      )}
    </div>
  )
}
