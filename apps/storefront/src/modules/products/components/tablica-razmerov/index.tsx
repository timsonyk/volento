"use client"

import { useState } from "react"

import Просмотр from "@modules/products/components/prosmotr"

/**
 * Кнопка «Таблица размеров» у выбора размера: открывает таблицу мерок
 * поверх страницы. Раньше таблица стояла последним снимком в галерее и
 * выглядела обрезанной фотографией (встреча 23 октября). Какой снимок —
 * таблица, узнаёт сервер (lib/util/tablica-mer.ts).
 */
export default function ТаблицаРазмеров({ таблицы }: { таблицы: string[] }) {
  const [открыта, setОткрыта] = useState(false)

  if (!таблицы.length) {
    return null
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setОткрыта(true)}
        className="text-sm text-ink underline underline-offset-4 transition-opacity hover:opacity-60"
        data-testid="tablica-razmerov"
      >
        Таблица размеров
      </button>
      {открыта && (
        <Просмотр снимки={таблицы} подпись="Таблица размеров" лист закрыть={() => setОткрыта(false)} />
      )}
    </>
  )
}
