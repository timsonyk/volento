import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { ПРОВАЙДЕР, почтаКлючом } from "../../../../lib/kod-vhoda"

/**
 * Связывает новый вход по коду с уже существующим покупателем.
 *
 * Зачем нужно. Раньше вход был по паролю, и у тех, кто успел завести
 * аккаунт, карточка покупателя уже есть. Вход по коду заводит новую
 * личность, и с прежней карточкой она никак не связана: витрина не
 * находит покупателя, предлагает познакомиться, а завести второго с тем
 * же адресом Medusa не даёт — «Customer with this email already has an
 * account». Человек упирается в стену на ровном месте.
 *
 * Почему связывать безопасно. Код пришёл на этот самый адрес, и человек
 * его ввёл, — а это и есть доказательство, что ящик его. На том и стоит
 * вход по почте.
 *
 * Что здесь обязательно проверяется: адрес берём не из запроса, а из
 * личности самого обратившегося. Иначе достаточно было бы прислать
 * чужую почту в теле запроса, чтобы забрать чужой аккаунт.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const { auth_identity_id: личностьИд, actor_id: ктоУже } =
    (req as any).auth_context ?? {}

  if (!личностьИд) {
    return res.status(401).json({ ошибка: "Нужен вход" })
  }

  // Уже связан — и хорошо, повторять нечего.
  if (ктоУже) {
    return res.json({ связан: true })
  }

  const auth = req.scope.resolve(Modules.AUTH)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const личность = await auth.retrieveAuthIdentity(личностьИд, {
      relations: ["provider_identities"],
    })

    const почта = почтаКлючом(
      личность.provider_identities?.find((з: any) => з.provider === ПРОВАЙДЕР)
        ?.entity_id ?? ""
    )

    if (!почта) {
      return res.json({ связан: false })
    }

    const { data: покупатели } = await query.graph({
      entity: "customer",
      filters: { email: почта, has_account: true },
      fields: ["id", "email"],
    })

    const покупатель = покупатели?.[0]
    if (!покупатель) {
      // Покупателя нет — значит, человек и правда у нас впервые,
      // витрина спросит имя и заведёт карточку обычным путём.
      return res.json({ связан: false })
    }

    await auth.updateAuthIdentities({
      id: личностьИд,
      app_metadata: {
        ...((личность.app_metadata as Record<string, unknown>) ?? {}),
        customer_id: покупатель.id,
      },
    })

    logger.info(`Вход по коду: ${почта} связан с покупателем ${покупатель.id}`)
    return res.json({ связан: true })
  } catch (ошибка: any) {
    logger.error(`Вход по коду: не связал личность: ${ошибка?.message}`)
    return res.status(500).json({ ошибка: "Не получилось войти" })
  }
}
