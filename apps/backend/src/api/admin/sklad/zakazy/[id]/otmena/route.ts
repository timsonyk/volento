import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { отменитьЗаказ } from "../../../../../../lib/sklad-ostatok"

/**
 * Кнопка в карточке заказа: склад собрал не всё, покупатель отказался.
 * Отмена возвращает деньги целиком и снимает резерв.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    await отменитьЗаказ(req.scope, req.params.id, req.auth_context?.actor_id)
    return res.json({ ok: true })
  } catch (ошибка: any) {
    logger.error(`Заказ ${req.params.id} не отменили: ${ошибка?.message}`)
    return res.status(500).json({ message: ошибка?.message ?? "Не получилось" })
  }
}
