import InteractiveLink from "@modules/common/components/interactive-link"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Страница не найдена | Volento",
  description: "Что-то пошло не так",
}

export default async function NotFound() {
  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-[calc(100vh-64px)]">
      <h1 className="text-2xl-semi text-ui-fg-base">Страница не найдена</h1>
      <p className="text-small-regular text-ui-fg-base">
        Страница, которую вы пытались открыть, не существует.
      </p>
      <InteractiveLink href="/">На главную</InteractiveLink>
    </div>
  )
}
