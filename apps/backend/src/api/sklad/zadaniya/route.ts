import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ВЗЯТ, НЕХВАТКА } from "../../../lib/sklad-sborka"
import { наЧасти } from "../../../lib/sklad-pozicii"
import { несобранныеЗаказы } from "../../../lib/sklad-ochered"
import { этоТест } from "../../../lib/sklad-test-metka"
import { пробный } from "../../../lib/zamok-zakazov"

/**
 * Сборочные задания — то же, что «новые заказы» у Вайлдберриза.
 *
 * Отдаём то, что ещё не собрано: заказ оплачен, не отменён и сборки по
 * нему нет. Взятые в работу («собираю») остаются в списке с отметкой
 * vzyato, пока склад не пришлёт «собрано» с кодами — тогда задание
 * пропадает само. Поэтому складу не нужно помнить, где он остановился,
 * и падение посреди ночи ничего не рвёт: наутро он просто снова
 * спросит, что несобранного.
 *
 * Именно этого в Medusa нет — у неё заказы фильтруются по дате и
 * статусу, но не по «за это ещё не брались».
 */
const ЗА_РАЗ = 100

/**
 * Куда везти. У доставки до пункта выдачи адреса в карточке заказа нет —
 * покупатель выбрал точку на карте, и она лежит в способе доставки.
 * Складу нужен именно этот адрес, иначе везти некуда.
 */
const доставка = (з: any) => {
  const способ = (з.shipping_methods ?? [])[0]
  const пункт = способ?.data?.apishipData?.point

  if (пункт) {
    return {
      sposob: "pvz",
      perevozchik: способ?.data?.apishipData?.tariff?.providerKey ?? null,
      punkt: {
        id: String(пункт.id),
        nazvanie: пункт.name,
        adres: пункт.address,
        rezhim: пункт.timetable ?? null,
      },
      gorod: з.shipping_address?.city ?? null,
    }
  }

  return {
    sposob: "kurier",
    gorod: з.shipping_address?.city ?? null,
    adres: з.shipping_address?.address_1 ?? null,
    indeks: з.shipping_address?.postal_code ?? null,
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // ?test=1 — только тестовые заказы (lib/sklad-test), без него — только настоящие
  const тест = req.query.test === "1"

  const сколько = Math.min(
    Number(req.query.limit) || ЗА_РАЗ,
    ЗА_РАЗ
  )

  try {
    const заказы = await несобранныеЗаказы(query, [
      "id",
      "display_id",
      "created_at",
      "email",
      "metadata",
      "items.id",
      "items.variant_sku",
      "items.title",
      // Количество лежит не в строке заказа, а в её «подробностях»:
      // в самой строке такого поля нет, и оно приходило пустым.
      "items.detail.quantity",
      "shipping_address.*",
      "shipping_methods.name",
      "shipping_methods.data",
    ])

    const задания = (заказы ?? [])
      .filter((з: any) => {
        // Пробные заказы, сделанные до открытия магазина, складу не
        // отдаём: собирать их не нужно.
        if (пробный(з)) {
          return false
        }
        if (этоТест(з) !== тест) {
          return false
        }
        // Собрали не всё и ждём, что скажет покупатель: решение примем
        // в админке, складу тут делать нечего.
        if ((з.metadata ?? {})[НЕХВАТКА]) {
          return false
        }
        return true
      })
      .slice(0, сколько)
      .map((з: any) => ({
        nomer: String(з.display_id),
        id: з.id,
        sozdan: з.created_at,
        // Склад уже ответил «собираю» (POST …/vzyat)
        vzyato: Boolean((з.metadata ?? {})[ВЗЯТ]),
        pozicii: (з.items ?? []).map((т: any) => {
          const части = наЧасти(т.variant_sku)
          return {
            artikul: т.variant_sku,
            ...(части
              ? { model: части.model, razmer: части.razmer, rost: части.rost }
              : {}),
            nazvanie: т.title,
            kolichestvo: Number(т.detail?.quantity ?? 0),
            // Нужен, когда склад будет подтверждать сборку построчно
            id_stroki: т.id,
          }
        }),
        dostavka: доставка(з),
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
