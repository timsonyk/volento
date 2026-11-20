"use client"

import "styles/globals.css"

import Сбой from "@modules/common/components/sboy"

/** Сбой в самой основе сайта: своя оболочка страницы обязательна. */
export default function GlobalError() {
  return (
    <html lang="ru" data-mode="light">
      <head>
        <title>Не получилось открыть страницу | Volento</title>
      </head>
      <body className="bg-paper font-sans text-ink antialiased">
        <Сбой повторить={() => window.location.reload()} />
      </body>
    </html>
  )
}
