"use client"

import { useEffect } from "react"

import { СМОТРЕЛИ } from "./smotreli"

const СКОЛЬКО = 12

/**
 * Запоминает открытую карточку для блока «Вы смотрели».
 *
 * Храним в cookie, а не в localStorage: блок рисует сервер, и cookie он
 * видит сразу, без второго запроса из браузера. Только id товаров, до
 * двенадцати, на месяц. Не вышло записать (запрещены cookie) — блока
 * просто не будет.
 *
 * Эта cookie не из необходимых: без неё работают и корзина, и вход.
 * Поэтому пишем её только после «Принять» в уведомлении о cookie. Кто
 * выбрал «Только необходимые» или ещё не выбрал, тому не пишем, а
 * записанную раньше стираем.
 */
const согласен = () => {
  try {
    const выбор = JSON.parse(localStorage.getItem("volento_cookie_consent") || "null")
    return выбор?.решение === "принято"
  } catch {
    return false
  }
}

export default function ZapomnitProsmotr({ id }: { id: string }) {
  useEffect(() => {
    try {
      if (!согласен()) {
        if (document.cookie.includes(`${СМОТРЕЛИ}=`)) {
          document.cookie = `${СМОТРЕЛИ}=; path=/; max-age=0; samesite=lax`
        }
        return
      }
      const было =
        document.cookie
          .split("; ")
          .find((c) => c.startsWith(`${СМОТРЕЛИ}=`))
          ?.slice(СМОТРЕЛИ.length + 1)
          .split(".")
          .filter(Boolean) ?? []
      const стало = [id, ...было.filter((x) => x !== id)].slice(0, СКОЛЬКО)
      document.cookie = `${СМОТРЕЛИ}=${стало.join(".")}; path=/; max-age=${30 * 24 * 3600}; samesite=lax`
    } catch {
      // без cookie обойдёмся
    }
  }, [id])

  return null
}
