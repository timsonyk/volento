"use client"

import { цветСЁ } from "@lib/util/cvet-s-yo"
import { useEffect, useState } from "react"

import { вещиПоАдресам } from "@lib/data/products"
import {
  Избранная,
  СОБЫТИЕ,
  прочитатьИзбранное,
  переключитьИзбранное,
} from "@lib/util/izbrannoe"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreview from "@modules/products/components/product-preview"
import Thumbnail from "@modules/products/components/thumbnail"

/**
 * Страница «Избранное»: отложенные вещи из браузера покупателя.
 *
 * В браузере лежат только адрес, название и снимок. Поэтому при открытии
 * спрашиваем у магазина свежие карточки: с ценой, как в каталоге. Вещь,
 * которой в ответе нет, снята с продажи: показываем её приглушённо и без
 * ссылки, чтобы покупатель не попадал на «страница не найдена». Если
 * магазин не ответил, показываем сохранённое как есть.
 */
const СписокИзбранного = ({
  region,
  countryCode,
}: {
  region: HttpTypes.StoreRegion
  countryCode: string
}) => {
  const [список, setСписок] = useState<Избранная[] | null>(null)
  // null: свежих данных нет (ещё грузятся или магазин не ответил)
  const [свежие, setСвежие] = useState<Record<string, HttpTypes.StoreProduct> | null>(null)

  useEffect(() => {
    const сохранённые = прочитатьИзбранное()
    setСписок(сохранённые)

    let отменено = false
    if (сохранённые.length) {
      вещиПоАдресам(
        сохранённые.map((в) => в.handle),
        countryCode
      )
        .then((товары) => {
          if (отменено) return
          setСвежие(Object.fromEntries(товары.map((p) => [p.handle, p])))
        })
        .catch(() => {})
    }

    // сердечко на карточке убирает вещь мимо этого списка
    const обновить = () => setСписок(прочитатьИзбранное())
    window.addEventListener(СОБЫТИЕ, обновить)
    return () => {
      отменено = true
      window.removeEventListener(СОБЫТИЕ, обновить)
    }
  }, [countryCode])

  if (список === null) {
    return <p className="py-16 text-center text-base text-muted">Загружаем…</p>
  }

  if (!список.length) {
    return (
      <p className="py-16 text-center text-base text-muted" data-testid="izbrannoe-pusto">
        Здесь пока пусто. Нажмите на сердечко у вещи, и она появится
        здесь.{" "}
        <LocalizedClientLink href="/store" className="text-ink underline underline-offset-4">
          Смотреть каталог
        </LocalizedClientLink>
      </p>
    )
  }

  const убрать = (в: Избранная) => (
    <button
      type="button"
      onClick={() => переключитьИзбранное(в)}
      className="mt-1 self-start py-2 pl-[13px] text-sm text-muted underline underline-offset-4 hover:text-ink xsmall:pl-[21px] medium:pl-3"
    >
      Убрать
    </button>
  )

  return (
    <ul
      className="grid grid-cols-2 gap-x-2 gap-y-10 small:grid-cols-4"
      data-testid="izbrannoe-spisok"
    >
      {список.map((в) => {
        const товар = свежие?.[в.handle]

        if (товар) {
          return (
            <li key={в.handle} className="flex flex-col" data-testid="izbrannoe-veshch">
              <ProductPreview
                product={товар}
                region={region}
                sizes="(max-width: 1023px) 48vw, 24vw"
              />
              {убрать(в)}
            </li>
          )
        }

        // Свежие пришли, а вещи в них нет: её больше не продают
        const снята = свежие !== null

        const плитка = (
          <>
            <Thumbnail thumbnail={в.thumbnail} size="full" />
            <span className="mt-2.5 block pl-[13px] text-sm leading-[1.3] text-ink xsmall:pl-[21px] small:text-base medium:pl-3">
              {цветСЁ(в.title)}
            </span>
          </>
        )

        return (
          <li
            key={в.handle}
            className="flex flex-col"
            data-testid={снята ? "izbrannoe-snyata" : "izbrannoe-veshch"}
          >
            {снята ? (
              <div>
                <div className="opacity-50">{плитка}</div>
                <p className="mt-1 pl-[13px] text-sm text-muted xsmall:pl-[21px] medium:pl-3">
                  Больше не продаётся
                </p>
              </div>
            ) : (
              <LocalizedClientLink href={`/products/${в.handle}`} className="block">
                {плитка}
              </LocalizedClientLink>
            )}
            {убрать(в)}
          </li>
        )
      })}
    </ul>
  )
}

export default СписокИзбранного
