import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { кассаВключена, незаконченныеЧеки, отправить, узнатьРезультат } from "../lib/kassa"
import { позвать } from "../lib/trevoga"

/**
 * Сторож чеков: дотправляет то, что не ушло в Атол, и узнаёт результат
 * того, что ушло. Как устроены чеки — lib/kassa.ts.
 *
 * Если чек не уходит час (Атол лежит или сеть), зовём человека — один
 * раз, на двенадцатой попытке.
 */
const ПОПЫТОК_ДО_ТРЕВОГИ = 12

export default async function кассаЧеки(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  if (!кассаВключена()) {
    return
  }

  try {
    for (const { заказ, чеки } of await незаконченныеЧеки(container)) {
      for (const чек of чеки) {
        if (чек.status === "wait" && чек.uuid) {
          await узнатьРезультат(container, заказ, чек)
          continue
        }

        await отправить(container, заказ.id, чек)

        if (чек.popytok + 1 === ПОПЫТОК_ДО_ТРЕВОГИ) {
          await позвать(container, {
            тема: `Чек не уходит в Атол: заказ ${заказ.display_id}`,
            текст: `Чек ${чек.id} не отправлен уже час: ${чек.oshibka ?? "причина неизвестна"}. Пробую дальше.`,
          })
        }
      }
    }
  } catch (ошибка: any) {
    logger.error(`Сторож чеков не отработал: ${ошибка?.message}`)
  }
}

export const config = {
  name: "kassa-cheki",
  schedule: "*/5 * * * *",
}
