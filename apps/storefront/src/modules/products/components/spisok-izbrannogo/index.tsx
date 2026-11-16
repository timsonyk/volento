"use client"

import { useEffect, useState } from "react"

import { Избранная, прочитатьИзбранное, переключитьИзбранное } from "@lib/util/izbrannoe"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"

/** Страница «Избранное» (образец): отложенные вещи из браузера покупателя. */
const СписокИзбранного = () => {
  const [список, setСписок] = useState<Избранная[] | null>(null)

  useEffect(() => {
    setСписок(прочитатьИзбранное())
  }, [])

  if (список === null) {
    return <p className="py-16 text-center text-base text-muted">Загружаем…</p>
  }

  if (!список.length) {
    return (
      <p className="py-16 text-center text-base text-muted" data-testid="izbrannoe-pusto">
        Здесь пока пусто. Нажмите «В избранное» на странице вещи, и она
        появится здесь.{" "}
        <LocalizedClientLink href="/store" className="text-ink underline underline-offset-4">
          Смотреть каталог
        </LocalizedClientLink>
      </p>
    )
  }

  return (
    <ul
      className="grid grid-cols-2 gap-x-4 gap-y-10 small:grid-cols-4"
      data-testid="izbrannoe-spisok"
    >
      {список.map((в) => (
        <li key={в.handle} className="flex flex-col">
          <LocalizedClientLink href={`/products/${в.handle}`} className="block">
            <Thumbnail thumbnail={в.thumbnail} size="full" />
            <span className="mt-2.5 block text-sm leading-[1.3] text-ink small:text-base">
              {в.title}
            </span>
          </LocalizedClientLink>
          <button
            type="button"
            onClick={() => {
              переключитьИзбранное(в)
              setСписок(прочитатьИзбранное())
            }}
            className="mt-1 self-start py-2 text-sm text-muted underline underline-offset-4 hover:text-ink"
          >
            Убрать
          </button>
        </li>
      ))}
    </ul>
  )
}

export default СписокИзбранного
