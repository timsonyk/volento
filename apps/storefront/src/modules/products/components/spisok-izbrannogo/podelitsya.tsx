"use client"

import { useEffect, useState } from "react"

import { Избранная } from "@lib/util/izbrannoe"

const КЛЮЧ_ОБРАЗЦА = "volento_obrazec_podelitsya"

/** Образец виден только тому, кто открыл «Избранное» с ?obrazec=podelitsya. */
const образецВключён = () => {
  try {
    const изАдреса = new URLSearchParams(window.location.search).get("obrazec")
    if (изАдреса === "podelitsya") localStorage.setItem(КЛЮЧ_ОБРАЗЦА, "1")
    if (изАдреса === "net") localStorage.removeItem(КЛЮЧ_ОБРАЗЦА)
    return localStorage.getItem(КЛЮЧ_ОБРАЗЦА) === "1"
  } catch {
    return false
  }
}

/**
 * Кнопка «Поделиться списком» (образец). Список избранного живёт в одном
 * браузере; ссылка переносит его на другое устройство или к подруге за
 * советом. В ссылке только адреса вещей, ничего о покупателе.
 */
const Поделиться = ({ список }: { список: Избранная[] }) => {
  const [видна, setВидна] = useState(false)
  const [скопировано, setСкопировано] = useState(false)

  useEffect(() => {
    setВидна(образецВключён())
  }, [])

  if (!видна || !список.length) {
    return null
  }

  const поделиться = async () => {
    const ссылка = `${window.location.origin}${window.location.pathname}?spisok=${список
      .map((в) => в.handle)
      .join(",")}`
    try {
      // на телефоне открывается обычное окно «Поделиться»
      if (navigator.share) {
        await navigator.share({ title: "Мой список Volento", url: ссылка })
        return
      }
      await navigator.clipboard.writeText(ссылка)
      setСкопировано(true)
      setTimeout(() => setСкопировано(false), 4000)
    } catch {
      // покупатель закрыл окно или браузер не дал доступ к буферу
    }
  }

  return (
    <div className="mb-6 flex items-center gap-x-4 text-sm">
      <button
        type="button"
        onClick={поделиться}
        className="border border-ink px-5 py-2.5 text-ink transition-colors hover:bg-ink hover:text-paper"
        data-testid="podelitsya-spiskom"
      >
        Поделиться списком
      </button>
      <span role="status" className="text-muted">
        {скопировано ? "Ссылка скопирована" : ""}
      </span>
    </div>
  )
}

export default Поделиться
