import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { создатьТестовыйЗаказ } from "../../../../lib/sklad-test"

/**
 * Создать тестовый заказ — чтобы склад проверил свой обмен, ничего не
 * отправляя на самом деле. Что в нём ненастоящее — lib/sklad-test.ts.
 *
 * Тело: { kolichestva: [3] } — одна строка, 3 шт.; [2, 1] — две строки.
 * Без тела — одна строка, 1 шт.
 *
 * pochta — заказ в кабинет покупателя с этой почтой (только @example.com:
 * для автотестов кнопки возврата).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const пришло = (req.body as { kolichestva?: unknown })?.kolichestva

  const количества = Array.isArray(пришло) && пришло.length ? пришло.map(Number) : [1]

  if (
    количества.length > 3 ||
    количества.some((ч) => !Number.isInteger(ч) || ч < 1 || ч > 10)
  ) {
    return res.status(400).json({
      ошибка: "kolichestva — до трёх строк, в каждой от 1 до 10 шт.",
    })
  }

  const почта = (req.body as { pochta?: unknown })?.pochta
  let покупатель: { id: string; email: string } | undefined
  if (почта !== undefined) {
    const адрес = String(почта).trim().toLowerCase()
    if (!адрес.endsWith("@example.com")) {
      return res.status(400).json({ ошибка: "pochta — только адреса @example.com" })
    }
    const [найден] = await req.scope.resolve(Modules.CUSTOMER).listCustomers({ email: адрес, has_account: true } as any)
    if (!найден) {
      return res.status(404).json({ ошибка: "Покупателя с такой почтой нет" })
    }
    покупатель = { id: найден.id, email: адрес }
  }

  try {
    // postamat: true — заказ «едет в постамат»: проверить, что делить его
    // на пакеты нельзя
    const постамат = (req.body as { postamat?: unknown })?.postamat === true
    const заказ = await создатьТестовыйЗаказ(req.scope, количества, покупатель, постамат)
    logger.info(`Склад создал тестовый заказ ${заказ.nomer}`)
    return res.json(заказ)
  } catch (ошибка: any) {
    logger.error(`Тестовый заказ не создался: ${ошибка?.message}`)
    return res.status(500).json({ ошибка: "Не удалось создать тестовый заказ", podrobnosti: ошибка?.message })
  }
}
