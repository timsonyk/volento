import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { собранныеНеУпакованные } from "../../../lib/sklad-upakovka"

/**
 * Что пора паковать: склад собрал, служба выдала наклейку.
 *
 * Наклейка появляется через несколько минут после «собрано» — служба
 * сначала заводит отправление. Пока её нет, заказ лежит в
 * zhdut_etiketku: склад видит, что он не потерялся.
 *
 * pakety — места отправления: что положить в каждый пакет, в каком
 * помещении он собран и своя наклейка. Заказ не делили — пакет один.
 * Пакетов несколько — на каждый клеится своя наклейка, а служба
 * принимает их все вместе, одним отправлением.
 *
 * Упаковал и отдал водителю — POST /sklad/zadaniya/{nomer}/upakovano,
 * заказ уходит из списка.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    // ?test=1 — только тестовые заказы, без него — только настоящие
    const тест = req.query.test === "1"
    const отправления = (await собранныеНеУпакованные(req.scope)).filter(
      (о) => о.тест === тест
    )

    return res.json({
      k_upakovke: отправления
        .filter((о) => о.наклейка)
        .map((о) => ({
          nomer: о.номер,
          perevozchik: о.служба,
          trek: о.трек,
          etiketka: `/sklad/zadaniya/${о.номер}/etiketka`,
          pozicii: о.позиции,
          pakety: о.пакеты.map((п) => ({
            ...п,
            etiketka:
              о.пакеты.length > 1
                ? `/sklad/zadaniya/${о.номер}/etiketka?paket=${п.nomer}`
                : `/sklad/zadaniya/${о.номер}/etiketka`,
          })),
        })),
      zhdut_etiketku: отправления.filter((о) => !о.наклейка).map((о) => о.номер),
    })
  } catch (ошибка: any) {
    logger.error(`Склад: не отдали список к упаковке — ${ошибка?.message}`)
    return res.status(500).json({ ошибка: "Не удалось получить список" })
  }
}
