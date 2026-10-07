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
 * Упаковал и отдал водителю — POST /sklad/zadaniya/{nomer}/upakovano,
 * заказ уходит из списка.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    const отправления = await собранныеНеУпакованные(req.scope)

    return res.json({
      k_upakovke: отправления
        .filter((о) => о.наклейка)
        .map((о) => ({
          nomer: о.номер,
          perevozchik: о.служба,
          trek: о.трек,
          etiketka: `/sklad/zadaniya/${о.номер}/etiketka`,
          pozicii: о.позиции,
        })),
      zhdut_etiketku: отправления.filter((о) => !о.наклейка).map((о) => о.номер),
    })
  } catch (ошибка: any) {
    logger.error(`Склад: не отдали список к упаковке — ${ошибка?.message}`)
    return res.status(500).json({ ошибка: "Не удалось получить список" })
  }
}
