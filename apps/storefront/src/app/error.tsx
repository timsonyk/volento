"use client"

import { useEffect } from "react"

import Сбой from "@modules/common/components/sboy"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <>
      <title>Не получилось открыть страницу | Volento</title>
      <Сбой
        повторить={() => {
          // сбой на сервере повтором отрисовки не лечится: нужна новая загрузка
          if (error.digest) window.location.reload()
          else reset()
        }}
      />
    </>
  )
}
