import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"

import { КОДЫ } from "./sklad-kody"
import { ПАКЕТЫ, type Пакет } from "./sklad-pakety"
import { позвать } from "./trevoga"

/**
 * Сборка заказа складом: коды «Честного знака» и сама сборка.
 *
 * Код маркировки склад присылает при сборке — до этого брюки лежат без
 * кодов, коды клеят, когда пакуют. Без кодов не выбить второй чек
 * («полный расчёт»): в нём касса обязана перечислить коды, и проверяет
 * каждый в «Честном знаке» (разрешительный режим). Поэтому без кодов
 * сборку не принимаем.
 *
 * Код одежды: 01 + GTIN из 14 цифр + 21 + серийный номер, дальше через
 * разделитель GS (символ \u001D) — 93 и криптохвост. Слать его надо
 * целиком, как отдаёт сканер: без хвоста касса чек не пробьёт.
 */
export { КОДЫ } from "./sklad-kody"
export const НЕХВАТКА = "sklad_nehvatka"
// склад взялся за заказ (POST /sklad/zadaniya/:nomer/vzyat)
export const ВЗЯТ = "sklad_vzyat"

const ПОХОЖ_НА_КОД = /^01\d{14}21\S/

export type КодыПоСтрокам = Record<string, string[]>

export type СтрокаСборки = {
  id: string
  quantity: number
  kody: string[]
}

/** Ошибка в кодах — человеческим языком, чтобы склад понял, что исправить. */
export function проверитьКоды(строки: СтрокаСборки[]): string | null {
  const все = new Set<string>()

  for (const с of строки) {
    if (с.kody.length !== с.quantity) {
      return `Строка ${с.id}: ${с.quantity} шт., а кодов ${с.kody.length} — нужно по коду на каждую штуку`
    }
    for (const код of с.kody) {
      if (!ПОХОЖ_НА_КОД.test(код)) {
        return `Строка ${с.id}: «${код.slice(0, 40)}» не похож на код маркировки — он начинается с 01, 14 цифр GTIN и 21`
      }
      if (все.has(код)) {
        return `Код «${код.slice(0, 40)}» прислан дважды — у каждой штуки свой`
      }
      все.add(код)
    }
  }

  return null
}

/**
 * Заводим сборку в Medusa — отсюда плагин ApiShip создаёт отправление в
 * службе, а наклейку подтягивает следом (сам, раз в пять минут, или
 * когда склад спросит список «к упаковке»).
 *
 * Коды пишем в заказ до сборки: провайдер доставки берёт их оттуда и
 * передаёт службе по каждой паре (lib/primerka.ts). Чек «полный расчёт»
 * здесь не пробиваем — только когда служба скажет, что покупатель забрал
 * (lib/dostavka-itog.ts): при примерке он может забрать не всё.
 *
 * пакеты — как склад разделил заказ (lib/sklad-pakety.ts). Не переданы —
 * остаётся то, что уже записано в заказе: так сборку после неполной
 * заводит кнопка в админке, а пакеты склад прислал раньше.
 */
export async function завестиСборку(
  scope: MedusaContainer,
  заказ: { id: string; display_id: number; metadata?: Record<string, any> | null },
  строки: СтрокаСборки[],
  пакеты?: Пакет[]
) {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
  const stockLocation = scope.resolve(Modules.STOCK_LOCATION)
  const orderModule = scope.resolve(Modules.ORDER)

  const склады = await stockLocation.listStockLocations({}, { take: 2 })

  if (склады.length !== 1) {
    logger.error(`Складов ${склады.length}, ожидался один`)
    throw new Error("Склад не определён")
  }

  // повтор после сбоя не должен удвоить коды — складываем без повторов
  const прежние: КодыПоСтрокам = (заказ.metadata ?? {})[КОДЫ] ?? {}
  const коды: КодыПоСтрокам = { ...прежние }
  for (const с of строки) {
    коды[с.id] = [...new Set([...(коды[с.id] ?? []), ...с.kody])]
  }

  // Нехватку, если была, закрываем: заказ дальше идёт обычным путём.
  await orderModule.updateOrders([
    {
      id: заказ.id,
      metadata: {
        ...(заказ.metadata ?? {}),
        [КОДЫ]: коды,
        [НЕХВАТКА]: null,
        ...(пакеты ? { [ПАКЕТЫ]: пакеты } : {}),
      },
    },
  ])

  const { result } = await createOrderFulfillmentWorkflow(scope).run({
    input: {
      order_id: заказ.id,
      location_id: склады[0].id,
      items: строки.map((с) => ({ id: с.id, quantity: с.quantity })),
    } as any,
  })

  const сборка: any = result
  if (сборка?.data?.primerka === false) {
    await позвать(scope, {
      тема: `Заказ ${заказ.display_id} ушёл без примерки`,
      текст:
        `Служба не приняла заказ с частичным выкупом и примеркой, отправили без них — ` +
        `покупатель сможет забрать посылку только целиком.\n\nОтвет службы: ${сборка.data.primerka_oshibka}`,
    })
  }

  return сборка?.id as string | undefined
}
