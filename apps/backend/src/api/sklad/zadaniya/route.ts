import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { наЧасти } from "../../../lib/sklad-pozicii"

/**
 * Новые сборочные задания — то же, что «новые заказы» у Вайлдберриза.
 *
 * Отдаём только то, за что склад ещё не взялся: заказ оплачен, не
 * отменён и сборки по нему нет. Как только склад ответил «соберём»,
 * задание из этого списка пропадает само. Поэтому складу не нужно
 * помнить, где он остановился, и падение посреди ночи ничего не рвёт:
 * наутро он просто снова спросит, что несобранного.
 *
 * Именно этого в Medusa нет — у неё заказы фильтруются по дате и
 * статусу, но не по «за это ещё не брались».
 */
const ЗА_РАЗ = 100

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const сколько = Math.min(
    Number(req.query.limit) || ЗА_РАЗ,
    ЗА_РАЗ
  )

  try {
    const { data: заказы } = await query.graph({
      entity: "order",
      filters: { status: "pending" },
      fields: [
        "id",
        "display_id",
        "created_at",
        "email",
        "items.id",
        "items.variant_sku",
        "items.title",
        "items.quantity",
        "items.detail.fulfilled_quantity",
        "shipping_address.*",
        "fulfillments.id",
        "fulfillments.canceled_at",
      ],
      pagination: { order: { created_at: "ASC" }, take: сколько * 3 },
    })

    const задания = (заказы ?? [])
      .filter((з: any) => {
        // Отменённую сборку в счёт не берём: после неё заказ снова
        // ждёт склада, и задание должно вернуться в список.
        const живыеСборки = (з.fulfillments ?? []).filter(
          (с: any) => !с.canceled_at
        )
        return живыеСборки.length === 0
      })
      .slice(0, сколько)
      .map((з: any) => ({
        nomer: String(з.display_id),
        id: з.id,
        sozdan: з.created_at,
        pozicii: (з.items ?? []).map((т: any) => {
          const части = наЧасти(т.variant_sku)
          return {
            artikul: т.variant_sku,
            ...(части
              ? { model: части.model, razmer: части.razmer, rost: части.rost }
              : {}),
            nazvanie: т.title,
            kolichestvo: т.quantity,
            // Нужен, когда склад будет подтверждать сборку построчно
            id_stroki: т.id,
          }
        }),
        dostavka: з.shipping_address
          ? {
              gorod: з.shipping_address.city,
              adres: з.shipping_address.address_1,
              indeks: з.shipping_address.postal_code,
            }
          : null,
        poluchatel: з.shipping_address
          ? {
              imya: [з.shipping_address.first_name, з.shipping_address.last_name]
                .filter(Boolean)
                .join(" "),
              telefon: з.shipping_address.phone,
            }
          : null,
      }))

    return res.json({ zadaniya: задания })
  } catch (ошибка: any) {
    logger.error(`Склад: не отдали задания — ${ошибка?.message}`)
    return res.status(500).json({ ошибка: "Не удалось получить задания" })
  }
}
