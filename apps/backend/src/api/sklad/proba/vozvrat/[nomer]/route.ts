import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { найтиЗаказ } from "../../../../../lib/sklad-zakaz"
import { этоТест } from "../../../../../lib/sklad-test-metka"
import { ОшибкаВозврата, можноВернуть, прочитатьЗаказ, создатьЗаявку } from "../../../../../lib/vozvrat-pokupatelya"

/**
 * Тестовая заявка на возврат — то, что покупатель делает кнопкой в
 * кабинете. Только для тестовых заказов, после выдачи.
 *
 * Тело: { shtuk: 2 } — вернуть первые две из того, что можно вернуть;
 * без тела — всё.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const номер = String((req.params as any).nomer ?? "")
  const найден = await найтиЗаказ(req, номер)

  if (!найден) {
    return res.status(404).json({ ошибка: "Заказ не найден" })
  }
  if (!этоТест(найден)) {
    return res.status(403).json({ ошибка: "Только для тестовых заказов" })
  }

  const заказ = await прочитатьЗаказ(req.scope, найден.id)
  const пары = можноВернуть(заказ).пары
  const штук = Number((req.body as { shtuk?: unknown })?.shtuk ?? пары.length)

  try {
    const заявка = await создатьЗаявку(req.scope, заказ.id, пары.slice(0, штук).map((п) => п.kod), "Не подошёл размер")
    logger.info(`Тестовая заявка на возврат ${заявка.nomer}`)
    return res.json(заявка)
  } catch (ошибка: any) {
    if (ошибка instanceof ОшибкаВозврата) {
      return res.status(409).json({ ошибка: ошибка.message })
    }
    return res.status(500).json({ ошибка: "Не удалось", podrobnosti: ошибка?.message })
  }
}
