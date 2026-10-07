import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { отправитьОстаток } from "../../../../../../lib/sklad-ostatok"

/**
 * Кнопка в карточке заказа: склад собрал не всё, покупатель согласен
 * получить то, что есть. Подробности — lib/sklad-ostatok.ts.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    await отправитьОстаток(req.scope, req.params.id, req.auth_context?.actor_id)
    return res.json({ ok: true })
  } catch (ошибка: any) {
    logger.error(`Остаток по заказу ${req.params.id} не отправили: ${ошибка?.message}`)
    return res.status(500).json({ message: ошибка?.message ?? "Не получилось" })
  }
}
