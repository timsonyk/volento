import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

import { письмоКода, текстКода, темаКода } from "../../../lib/kod-email"
import {
  ЖИВЁТ,
  ПРОВАЙДЕР,
  новыйКод,
  отпечаток,
  почтаКлючом,
} from "../../../lib/kod-vhoda"

/**
 * Выдаёт код для входа: придумывает число, кладёт его отпечаток личности
 * и шлёт письмо.
 *
 * Что бы ни случилось дальше, ответ один и тот же — «письмо ушло».
 * Сказать «такого адреса у нас нет» означало бы отдать любому желающему
 * список наших покупателей: перебирая адреса, он бы их вычислил.
 *
 * Исключение одно — слишком частые запросы: про них говорим честно,
 * иначе человек будет жать кнопку и недоумевать, почему письма нет.
 *
 * Проверять сам код эта ручка не умеет: этим занимается провайдер,
 * обычным входом через /auth/customer/kod.
 */

// Примитивная проверка: поймать опечатку, а не пересказать стандарт.
const ПОХОЖЕ_НА_ПОЧТУ = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve("logger")
  const почта = почтаКлючом(String((req.body as any)?.email ?? ""))

  if (!почта || !ПОХОЖЕ_НА_ПОЧТУ.test(почта)) {
    return res.status(400).json({ ошибка: "Проверьте адрес почты", message: "Проверьте адрес почты" })
  }

  const auth = req.scope.resolve(Modules.AUTH)
  const notification = req.scope.resolve(Modules.NOTIFICATION)

  // Личность нужна до кода: положить отпечаток некуда, пока её нет.
  const заведена = await auth.register(ПРОВАЙДЕР, { body: { email: почта } } as any)
  if (!заведена.success) {
    logger.error(`Вход по коду: не завёл личность ${почта}: ${заведена.error}`)
    return res.status(500).json({ ошибка: "Не получилось отправить письмо" })
  }

  const код = новыйКод()
  const записан = await auth.updateProvider(ПРОВАЙДЕР, {
    entity_id: почта,
    отпечаток: отпечаток(код, почта),
  } as any)

  if (!записан.success) {
    const рано = String(записан.error ?? "").startsWith("рано:")
    if (рано) {
      const секунд = Number(String(записан.error).split(":")[1] || 60)
      const текст = `Письмо уже отправлено. Следующее можно запросить через ${секунд} с.`
      // message дублирует наш текст нарочно: клиентская библиотека
      // строит сообщение об ошибке именно по этому полю, а без него
      // покупателю доставалось безликое «не получилось отправить».
      return res.status(429).json({ ошибка: текст, message: текст, черезСекунд: секунд })
    }
    logger.error(`Вход по коду: не записал код для ${почта}: ${записан.error}`)
    return res.status(500).json({ ошибка: "Не получилось отправить письмо" })
  }

  const минут = Math.round(ЖИВЁТ / 60000)

  try {
    await notification.createNotifications({
      to: почта,
      channel: "email",
      template: "vhod-kod",
      // Код входа шлём от info@: так просил Тимофей. Заказы при этом
      // по-прежнему уходят от zakaz@ — см. medusa-config.
      from: process.env.EMAIL_FROM_KOD || "Volento <info@volento.com>",
      content: {
        subject: темаКода(код),
        text: текстКода(код, минут),
        html: письмоКода(код, минут),
      },
    })
  } catch (ошибка: any) {
    logger.error(`Вход по коду: письмо на ${почта} не ушло: ${ошибка?.message}`)
    return res.status(502).json({ ошибка: "Почта не отвечает. Попробуйте позже." })
  }

  return res.json({ отправлено: true, живёт: минут })
}
