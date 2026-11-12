import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import {
  НЕХВАТКА,
  type СтрокаСборки,
  завестиСборку,
  проверитьКоды,
} from "../../../../../lib/sklad-sborka"
import {
  ПАКЕТЫ,
  безПустых,
  разобратьСборку,
  этоПостамат,
} from "../../../../../lib/sklad-pakety"
import { этоТест } from "../../../../../lib/sklad-test-metka"
import { найтиЗаказ } from "../../../../../lib/sklad-zakaz"
import { позвать } from "../../../../../lib/trevoga"

/**
 * Склад собрал заказ — то же, что «подтвердить сборочное задание» у
 * Вайлдберриза, только вместе с кодами «Честного знака».
 *
 * Тело: { pozicii: [{ id_stroki, kolichestvo, kody: [...] }] } — по коду
 * на каждую штуку. Строку можно назвать и артикулом (artikul).
 *
 * Вещи лежат в двух помещениях — склад делит заказ на пакеты:
 * { pakety: [{ sklad, pozicii: [...] }, { sklad, pozicii: [...] }] }.
 * В службу уйдёт одно отправление из стольких же мест, наклейка будет на
 * каждое (lib/sklad-pakety.ts).
 *
 * Собрано всё — заводим сборку: плагин ApiShip создаёт отправление, и
 * через несколько минут заказ с наклейкой появится в /sklad/k-upakovke.
 *
 * Собрано не всё — сборку не заводим. Заказ встаёт на паузу, нам
 * приходит письмо: звоним покупателю и решаем в админке — отправить то,
 * что есть (за остальное вернём деньги), или отменить заказ целиком.
 * Отправлять половину без спроса нельзя: брюки без пиджака от костюма
 * покупателю могут быть не нужны.
 *
 * Повторный вызов не ошибка: склад мог не получить наш ответ. Отвечаем
 * тем же состоянием, второй сборки не заводим — иначе остаток списался
 * бы дважды.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const orderModule = req.scope.resolve(Modules.ORDER)
  const номер = String((req.params as any).nomer ?? "")

  const заказ = await найтиЗаказ(req, номер)

  if (!заказ) {
    return res.status(404).json({ ошибка: "Заказ не найден" })
  }

  if (заказ.status === "canceled") {
    return res.status(409).json({ ошибка: "Заказ отменён" })
  }

  if (заказ.живыеСборки > 0) {
    return res.json({ nomer: номер, sostoyanie: "uzhe_v_sborke" })
  }

  if ((заказ.metadata ?? {})[НЕХВАТКА]) {
    return res.json({ nomer: номер, sostoyanie: "zhdem_klienta" })
  }

  const разбор = разобратьСборку(req.body, заказ)

  if ("ошибка" in разбор) {
    return res.status(400).json({ ошибка: разбор.ошибка, ...(разбор.подробности ?? {}) })
  }

  const строки: СтрокаСборки[] = разбор.строки
  const пакеты = безПустых(разбор.пакеты)

  if (пакеты.length > 1 && этоПостамат(заказ.пункт, заказ.тариф)) {
    return res.status(409).json({
      ошибка:
        "Этот заказ едет в постамат — в ячейку кладут одно место. Соберите его одним пакетом",
    })
  }

  const ошибкаКодов = проверитьКоды(строки)

  if (ошибкаКодов) {
    return res.status(400).json({ ошибка: ошибкаКодов })
  }

  const собрано = строки.filter((с) => с.quantity > 0)

  if (!собрано.length) {
    return res.status(400).json({
      ошибка: "Ничего не собрано — это отказ, а не сборка",
      podskazka: `POST /sklad/zadaniya/${номер}/otkaz`,
    })
  }

  const неХватает = заказ.items
    .map((т) => ({
      т,
      нет: т.quantity - (строки.find((с) => с.id === т.id)?.quantity ?? 0),
    }))
    .filter(({ нет }) => нет > 0)

  if (неХватает.length) {
    const нехватка = {
      kogda: new Date().toISOString(),
      sobrano: собрано,
      ne_hvataet: неХватает.map(({ т, нет }) => ({
        id_stroki: т.id,
        artikul: т.variant_sku ?? null,
        nazvanie: т.title ?? null,
        kolichestvo: нет,
      })),
    }

    await orderModule.updateOrders([
      {
        id: заказ.id,
        // пакеты помним: сборку потом заведёт кнопка в админке
        metadata: { ...(заказ.metadata ?? {}), [НЕХВАТКА]: нехватка, [ПАКЕТЫ]: пакеты },
      },
    ])

    const чего = нехватка.ne_hvataet
      .map((н) => `${н.artikul ?? н.nazvanie} — ${н.kolichestvo} шт.`)
      .join("\n")

    await позвать(req.scope, {
      тест: этоТест(заказ),
      тема: `Заказ ${заказ.display_id}: склад собрал не всё — позвоните покупателю`,
      текст:
        `Не хватает:\n${чего}\n\n` +
        `Спросите покупателя: отправить то, что есть (за остальное вернём деньги), ` +
        `или отменить заказ целиком. Решение — кнопкой в карточке заказа в админке.`,
    })

    logger.warn(`Склад собрал заказ ${заказ.display_id} не полностью, ждём решения`)

    return res.json({ nomer: номер, sostoyanie: "zhdem_klienta" })
  }

  try {
    const idСборки = await завестиСборку(req.scope, заказ, собрано, пакеты)

    logger.info(`Склад собрал заказ ${заказ.display_id}, пакетов: ${пакеты.length}`)

    return res.json({
      nomer: номер,
      sostoyanie: "v_sborke",
      id_sborki: idСборки,
      paketov: пакеты.length,
    })
  } catch (ошибка: any) {
    logger.error(`Склад: сборка заказа ${номер} не завелась — ${ошибка?.message}`)
    return res
      .status(500)
      .json({ ошибка: "Не удалось взять в сборку", podrobnosti: ошибка?.message })
  }
}
