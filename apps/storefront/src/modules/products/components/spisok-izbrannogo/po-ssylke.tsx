"use client"

import { useEffect, useState } from "react"

import { вещиПоАдресам } from "@lib/data/products"
import { прочитатьИзбранное, переключитьИзбранное } from "@lib/util/izbrannoe"
import { HttpTypes } from "@medusajs/types"
import ProductPreview from "@modules/products/components/product-preview"

/**
 * Список, открытый по ссылке «Поделиться» (образец). Показывает вещи из
 * ссылки, которые сейчас продаются, и предлагает забрать их в своё
 * избранное. Своё избранное при этом не затирается, а дополняется.
 */
const СписокПоСсылке = ({
  адреса,
  region,
  countryCode,
  закрыть,
}: {
  адреса: string[]
  region: HttpTypes.StoreRegion
  countryCode: string
  закрыть: () => void
}) => {
  const [товары, setТовары] = useState<HttpTypes.StoreProduct[] | null>(null)

  useEffect(() => {
    let отменено = false
    вещиПоАдресам(адреса, countryCode)
      .then((т) => {
        if (отменено) return
        // в том порядке, в каком вещи стояли у отправителя
        const место = new Map(адреса.map((а, и) => [а, и]))
        setТовары([...т].sort((а, б) => (место.get(а.handle!) ?? 0) - (место.get(б.handle!) ?? 0)))
      })
      .catch(() => !отменено && setТовары([]))
    return () => {
      отменено = true
    }
  }, [адреса, countryCode])

  if (товары === null) {
    return <p className="py-16 text-center text-base text-muted">Загружаем…</p>
  }

  const забрать = () => {
    const мои = new Set(прочитатьИзбранное().map((в) => в.handle))
    // с конца: переключитьИзбранное ставит вещь первой, порядок сохранится
    for (const p of [...товары].reverse()) {
      if (p.handle && !мои.has(p.handle)) {
        переключитьИзбранное({ handle: p.handle, title: p.title, thumbnail: p.thumbnail })
      }
    }
    закрыть()
  }

  return (
    <div data-testid="spisok-po-ssylke">
      <p className="mb-6 text-base text-muted">
        {товары.length
          ? "Этим списком с вами поделились."
          : "Вещей из этого списка сейчас нет в продаже."}
      </p>
      <div className="mb-8 flex flex-wrap gap-3 text-sm">
        {товары.length > 0 && (
          <button
            type="button"
            onClick={забрать}
            className="border border-ink bg-ink px-5 py-2.5 text-paper transition-opacity hover:opacity-80"
            data-testid="zabrat-spisok"
          >
            Добавить всё в моё избранное
          </button>
        )}
        <button
          type="button"
          onClick={закрыть}
          className="border border-ink px-5 py-2.5 text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          Открыть моё избранное
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-10 small:grid-cols-4">
        {товары.map((p) => (
          <li key={p.id}>
            <ProductPreview product={p} region={region} sizes="(max-width: 1023px) 48vw, 24vw" />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default СписокПоСсылке
