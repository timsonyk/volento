import { Metadata } from "next"

/**
 * Страница, которая всегда падает. Нужна только сценариям проверки: по
 * ней видно, что при сбое покупатель получает нашу заглушку, а не
 * английскую стандартную. Ссылок на неё нет, поисковикам закрыта.
 */
export const dynamic = "force-dynamic"

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function Page() {
  throw new Error("Проверочный сбой: так и задумано")
}
