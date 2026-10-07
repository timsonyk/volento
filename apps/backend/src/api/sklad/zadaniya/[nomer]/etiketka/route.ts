import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { собранныеНеУпакованные } from "../../../../../lib/sklad-upakovka"

/**
 * Наклейка службы на посылку — PDF, как его отдаёт служба через ApiShip.
 *
 * Отдаём сами, а не ссылкой на ApiShip: склад ходит к нам с одним
 * ключом, а ссылка ApiShip может устареть. Размер листа задаётся в
 * кабинете ApiShip, в настройках подключения службы.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const номер = String((req.params as any).nomer ?? "")

  const [отправление] = await собранныеНеУпакованные(req.scope, номер)

  if (!отправление) {
    return res.status(404).json({
      ошибка: "Нет такого собранного неупакованного заказа",
    })
  }

  if (!отправление.наклейка) {
    return res.status(409).json({
      ошибка: "Служба ещё не выдала наклейку — попробуйте через пару минут",
    })
  }

  try {
    const ответ = await fetch(отправление.наклейка)

    if (!ответ.ok) {
      throw new Error(`ApiShip ответил ${ответ.status}`)
    }

    const pdf = Buffer.from(await ответ.arrayBuffer())

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader(
      "Content-Disposition",
      `inline; filename="nakleyka-${номер}.pdf"`
    )
    return res.send(pdf)
  } catch (ошибка: any) {
    logger.error(`Наклейка заказа ${номер} не скачалась: ${ошибка?.message}`)
    return res.status(502).json({ ошибка: "Не удалось получить наклейку у службы" })
  }
}
