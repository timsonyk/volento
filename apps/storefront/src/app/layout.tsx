import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import "styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-mode="light">
      <body className="bg-paper font-sans text-ink antialiased">
        {/* clip, а не hidden: hidden ломает липкую шапку */}
        <main className="relative overflow-x-clip">{props.children}</main>
      </body>
    </html>
  )
}
