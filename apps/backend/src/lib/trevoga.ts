import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Позвать человека: письмо на EMAIL_TREVOGA и колокольчик в админке.
 *
 * тест: true — заказ тестовый (lib/sklad-test), никого не зовём.
 *
 * Ошибку не пробрасываем — то, из-за чего зовём, уже записано в заказ,
 * и падать из-за почты нельзя. Неудачу видно в журнале.
 */
export async function позвать(
  scope: MedusaContainer,
  { тема, текст, тест = false }: { тема: string; текст: string; тест?: boolean }
) {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)

  // По тестовому заказу склада человека не зовём: ни письма, ни
  // колокольчика. Иначе каждая проверка склада сыпала письма «склад
  // собрал не всё» в рабочую почту.
  if (тест) {
    logger.info(`Тестовый заказ, человека не зовём: «${тема}»`)
    return
  }

  const notification = scope.resolve(Modules.NOTIFICATION)
  const кому = process.env.EMAIL_TREVOGA

  const уведомления: any[] = [
    {
      to: "",
      channel: "feed",
      template: "admin-ui",
      data: { title: тема, description: текст },
    },
  ]

  if (кому) {
    уведомления.push({
      to: кому,
      channel: "email",
      template: "trevoga",
      content: { subject: тема, text: текст },
    })
  }

  try {
    await notification.createNotifications(уведомления)
  } catch (ошибка: any) {
    logger.error(`Не дозвались человека («${тема}»): ${ошибка?.message}`)
  }
}
