import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Занят ли номер телефона другим покупателем.
 *
 * Зачем: по телефону курьер ищет получателя. Два аккаунта с одним
 * номером — это когда человек завёл второй по другой почте и забыл про
 * первый; звонок тогда уходит непонятно кому, а заказы разъезжаются по
 * двум карточкам.
 *
 * Почему за входом. Ручка отвечает «да» или «нет» про чужой номер, и без
 * защиты по ней можно было бы перебором выяснить, кто у нас покупает.
 * Спросить может только тот, кто уже ввёл код из письма, — а на каждую
 * попытку нужно новое письмо, и чаще раза в минуту его не получить.
 *
 * Считаем занятым только зарегистрированный аккаунт: гостевые карточки
 * заводятся на каждый заказ без входа, и блокировать по ним нельзя.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { auth_identity_id: личностьИд, actor_id: ктоЯ } =
    (req as any).auth_context ?? {}

  if (!личностьИд) {
    return res.status(401).json({ ошибка: "Нужен вход" })
  }

  const цифры = String((req.body as any)?.phone ?? "").replace(/\D/g, "")
  if (!цифры) {
    return res.status(400).json({ ошибка: "Не указан номер" })
  }

  // Храним номер с плюсом и семёркой: «8» в начале приводим к «7»,
  // иначе один и тот же номер в двух видах считался бы разными.
  const наш = цифры.startsWith("8") ? "7" + цифры.slice(1) : цифры
  const номер = "+" + наш

  try {
    const { data: покупатели } = await query.graph({
      entity: "customer",
      filters: { phone: номер, has_account: true },
      fields: ["id", "phone"],
    })

    // Свой же номер занятым не считаем: иначе нельзя было бы сохранить
    // профиль, ничего в нём не меняя.
    const чужой = (покупатели ?? []).some((п: any) => п.id !== ктоЯ)

    return res.json({ занят: чужой })
  } catch (ошибка: any) {
    logger.error(`Проверка телефона не удалась: ${ошибка?.message}`)
    // Не смогли проверить — не мешаем регистрации: отказать человеку
    // из-за нашей же поломки хуже, чем пропустить редкий повтор.
    return res.json({ занят: false })
  }
}
