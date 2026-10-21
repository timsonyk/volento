import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  ОшибкаВозврата,
  ПРИЧИНЫ,
  заявкиЗаказа,
  инструкция,
  можноВернуть,
  прочитатьЗаказ,
  создатьЗаявку,
} from "../../../../lib/vozvrat-pokupatelya"

/**
 * Возврат через кабинет (lib/vozvrat-pokupatelya.ts). Только свой заказ:
 * id заказа знают и посторонние (ссылка из письма), поэтому сверяем
 * покупателя.
 *
 * GET — что можно вернуть, до какого числа, и уже поданные заявки.
 * POST { kody, prichina?, kommentariy? } — подать заявку.
 */
async function свой(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const заказ = await прочитатьЗаказ(req.scope, String(req.params.id ?? ""))
  if (!заказ || !заказ.customer_id || заказ.customer_id !== req.auth_context?.actor_id) {
    res.status(404).json({ message: "Заказ не найден" })
    return null
  }
  return заказ
}

const ответ = (заказ: any) => {
  const можно = можноВернуть(заказ)
  return {
    do: можно.до,
    pary: можно.пары.map((п) => ({ id_stroki: п.id_stroki, kod: п.kod, nazvanie: п.nazvanie, artikul: п.artikul })),
    prichiny: ПРИЧИНЫ,
    instrukciya: инструкция(),
    zayavki: заявкиЗаказа(заказ).map((з) => ({
      nomer: з.nomer,
      sozdana: з.sozdana,
      status: з.status,
      shtuk: з.pary.length,
      vernuli: з.prinyato?.vernuli ?? null,
      otkloneno: з.prinyato?.otkloneno?.length ?? 0,
    })),
  }
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const заказ = await свой(req, res)
  if (!заказ) return
  return res.json(ответ(заказ))
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const заказ = await свой(req, res)
  if (!заказ) return

  const тело = (req.body ?? {}) as { kody?: unknown; prichina?: unknown; kommentariy?: unknown }
  if (!Array.isArray(тело.kody)) {
    return res.status(400).json({ message: "Отметьте, что возвращаете" })
  }

  try {
    const заявка = await создатьЗаявку(
      req.scope,
      заказ.id,
      тело.kody.map(String),
      тело.prichina ? String(тело.prichina) : undefined,
      тело.kommentariy ? String(тело.kommentariy) : undefined
    )
    return res.json({ nomer: заявка.nomer, ...ответ(await прочитатьЗаказ(req.scope, заказ.id)) })
  } catch (ошибка: any) {
    if (ошибка instanceof ОшибкаВозврата) {
      return res.status(400).json({ message: ошибка.message })
    }
    logger.error(`Возврат по заказу ${заказ.display_id} не оформлен — ${ошибка?.message}`)
    return res.status(500).json({ message: "Не получилось оформить возврат. Попробуйте ещё раз или напишите нам." })
  }
}
