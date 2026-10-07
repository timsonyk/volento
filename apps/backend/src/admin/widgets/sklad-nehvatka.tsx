import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Heading, Text, toast, usePrompt } from "@medusajs/ui"
import { useState } from "react"

import { апи } from "../lib/api"

type Нехватка = {
  kogda: string
  ne_hvataet: { id_stroki: string; artikul: string | null; nazvanie: string | null; kolichestvo: number }[]
  etap?: string
}

/**
 * Склад собрал заказ не полностью — звоним покупателю и решаем здесь.
 *
 * Блок виден только у таких заказов (отметка sklad_nehvatka, её ставит
 * POST /sklad/zadaniya/:nomer/sborka). Что делают кнопки —
 * lib/sklad-ostatok.ts.
 */
const SkladNehvatka = ({ data: заказ }: DetailWidgetProps<AdminOrder>) => {
  const нехватка = (заказ.metadata ?? {}).sklad_nehvatka as Нехватка | null | undefined
  const спросить = usePrompt()
  const [занят, setЗанят] = useState(false)

  if (!нехватка || заказ.status === "canceled") {
    return null
  }

  const сделать = async (что: "ostatok" | "otmena") => {
    const согласен = await спросить({
      title: что === "ostatok" ? "Отправить то, что есть?" : "Отменить заказ?",
      description:
        что === "ostatok"
          ? "Недостающее уберём из заказа и вернём за него деньги. Остальное склад упакует и отправит."
          : "Деньги вернутся покупателю целиком.",
      confirmText: что === "ostatok" ? "Отправить остаток" : "Отменить заказ",
      cancelText: "Назад",
    })

    if (!согласен) {
      return
    }

    setЗанят(true)
    try {
      await апи("POST", `/admin/sklad/zakazy/${заказ.id}/${что}`)
      toast.success(что === "ostatok" ? "Остаток отправлен на упаковку" : "Заказ отменён")
      window.location.reload()
    } catch (ошибка: any) {
      toast.error(ошибка?.message ?? "Не получилось")
      setЗанят(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Склад собрал не всё — позвоните покупателю</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Спросите, отправить ли то, что есть, или отменить заказ.
        </Text>
      </div>
      <div className="px-6 py-4">
        <Text size="small" weight="plus">Не хватает:</Text>
        {нехватка.ne_hvataet.map((н) => (
          <Text size="small" key={н.id_stroki}>
            {н.nazvanie ?? н.artikul} ({н.artikul}) — {н.kolichestvo} шт.
          </Text>
        ))}
      </div>
      <div className="flex gap-x-2 px-6 py-4">
        <Button size="small" disabled={занят} onClick={() => сделать("ostatok")}>
          Отправить остаток
        </Button>
        <Button
          size="small"
          variant="danger"
          disabled={занят}
          onClick={() => сделать("otmena")}
        >
          Отменить заказ
        </Button>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  // Правая колонка, сверху: «order.details.before» Medusa ставит в самый
  // низ, под метаданные, — блок не видно без прокрутки
  zone: "order.details.side.before",
})

export default SkladNehvatka
