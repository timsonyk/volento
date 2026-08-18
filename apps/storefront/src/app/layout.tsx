import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import { Manrope, Prata } from "next/font/google"
import "styles/globals.css"

// Prata — высококонтрастная антиква с кириллицей, продолжает начертание
// логотипа. Bodoni и Playfair сюда не годятся: у первого нет кириллицы,
// второй встречается на каждом втором сайте.
const display = Prata({
  subsets: ["cyrillic", "latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
})

const sans = Manrope({
  subsets: ["cyrillic", "latin"],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      data-mode="light"
      className={`${display.variable} ${sans.variable}`}
    >
      <body className="bg-paper font-sans text-ink antialiased">
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
