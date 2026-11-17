"use client"

import { useEffect, useState } from "react"

import {
  Просмотренная,
  записатьПросмотр,
  образецВключён,
} from "@lib/util/smotreli"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"

/**
 * Лента «Вы смотрели» под карточкой товара (образец): последние открытые
 * вещи, чтобы вернуться к ним, не листая каталог заново. На телефоне
 * лента листается пальцем, на компьютере помещается в ряд.
 */
const ВыСмотрели = ({ вещь }: { вещь: Просмотренная }) => {
  const [список, setСписок] = useState<Просмотренная[]>([])

  useEffect(() => {
    if (!образецВключён() || !вещь.handle) return
    setСписок(записатьПросмотр(вещь))
    // записываем один раз на вещь; название и снимок у неё не меняются
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [вещь.handle])

  if (!список.length) {
    return null
  }

  return (
    <section
      className="content-container mb-16 small:mb-24"
      aria-labelledby="vy-smotreli-zagolovok"
      data-testid="vy-smotreli"
    >
      <h2 id="vy-smotreli-zagolovok" className="mb-6 text-xl text-ink small:text-2xl">
        Вы смотрели
      </h2>
      <ul className="no-scrollbar -mx-4 flex gap-x-2 overflow-x-auto px-4 small:mx-0 small:px-0">
        {список.map((в) => (
          <li key={в.handle} className="w-[38vw] shrink-0 small:w-[calc((100%-56px)/8)]">
            <LocalizedClientLink href={`/products/${в.handle}`} className="block">
              <Thumbnail thumbnail={в.thumbnail} size="full" />
              <span className="mt-2 line-clamp-2 block text-sm leading-[1.3] text-ink">
                {в.title}
              </span>
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default ВыСмотрели
