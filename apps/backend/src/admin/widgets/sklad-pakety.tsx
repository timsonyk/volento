import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { Container, Heading, Text } from "@medusajs/ui"

/**
 * Заказ, который склад разделил на несколько пакетов: какой пакет в каком
 * помещении собран и что в нём лежит. Заказ одним пакетом блок не
 * показывает — там смотреть нечего.
 */
type Пакет = {
  nomer: number
  sklad: string | null
  stroki: { id: string; quantity: number }[]
}

const SkladPakety = ({ data: заказ }: DetailWidgetProps<AdminOrder>) => {
  const пакеты = ((заказ.metadata ?? {}).sklad_pakety ?? []) as Пакет[]

  if (!Array.isArray(пакеты) || пакеты.length < 2) {
    return null
  }

  const строка = (id: string) => (заказ.items ?? []).find((т) => т.id === id)

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Склад отправил заказ {пакеты.length} пакетами</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Одно отправление, один трек: покупатель получит все пакеты разом.
        </Text>
      </div>
      {пакеты.map((п) => (
        <div className="px-6 py-4" key={п.nomer}>
          <Text size="small" weight="plus">
            Пакет {п.nomer}
            {п.sklad ? ` — помещение «${п.sklad}»` : ""}
          </Text>
          {п.stroki.map((с) => (
            <Text size="small" key={с.id}>
              {строка(с.id)?.title ?? с.id} ({строка(с.id)?.variant_sku ?? "без артикула"}) — {с.quantity} шт.
            </Text>
          ))}
        </div>
      ))}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})

export default SkladPakety
