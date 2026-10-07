import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  обновитьНаклейку,
  собранныеНеУпакованные,
} from "../../../../../lib/sklad-upakovka"

/**
 * Наклейка службы на посылку — PDF, как его отдаёт служба через ApiShip.
 *
 * Отдаём сами, а не ссылкой на ApiShip: склад ходит к нам с одним
 * ключом, а ссылка может устареть — тогда берём у ApiShip свежую.
 * Размер листа задаётся в кабинете ApiShip, в настройках подключения
 * службы.
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

  const скачать = async (ссылка: string) => {
    const ответ = await fetch(ссылка)
    if (!ответ.ok) {
      throw new Error(`ApiShip ответил ${ответ.status}`)
    }
    return ответ
  }

  try {
    let ответ: Response
    try {
      ответ = await скачать(отправление.наклейка)
    } catch (ошибка: any) {
      // Ссылка устарела — берём у ApiShip свежую
      logger.warn(`Наклейка заказа ${номер}: ${ошибка?.message}, запрашиваем заново`)
      const свежая = await обновитьНаклейку(req.scope, отправление.idСборки)
      if (!свежая) {
        throw ошибка
      }
      ответ = await скачать(свежая)
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
