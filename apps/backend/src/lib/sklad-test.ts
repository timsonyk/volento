import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createOrderPaymentCollectionWorkflow,
  createOrderWorkflow,
  markPaymentCollectionAsPaid,
} from "@medusajs/medusa/core-flows"

import { ТЕСТ } from "./sklad-test-metka"

/**
 * Тестовые заказы для склада — проверить обмен целиком, ничего не
 * отправляя на самом деле.
 *
 * Тестовый заказ:
 * - оплачен «системной» оплатой Medusa, без банка — возврат тоже без банка;
 * - позиции без товара из каталога — только название, артикул и цена
 *   10 ₽: на витрине их нет, настоящие остатки не трогаются;
 * - отправление по нему в службу не уходит: провайдер доставки видит
 *   отметку в способе доставки и выдаёт поддельный трек и наклейку
 *   (modules/dostavka-apiship);
 * - в обычных списках склада его нет, только с ?test=1; сторож о нём
 *   молчит.
 *
 * Дальше он проходит те же ручки, что и настоящий: «собираю», «собрано»
 * с кодами, «к упаковке», наклейка, «упаковано», отказ, нехватка.
 */

const РАЗМЕРЫ = ["46/170", "48/176", "50/182"]

/** kolichestva — по строке на число: [3] — одна строка, 3 шт.; [2, 1] — две. */
export async function создатьТестовыйЗаказ(scope: MedusaContainer, количества: number[]) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: способы } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name"],
    filters: { provider_id: "apiship_apiship" } as any,
  })
  const способ: any = способы?.[0]
  if (!способ) {
    throw new Error("Нет способа доставки ApiShip")
  }

  const { data: регионы } = await query.graph({ entity: "region", fields: ["id"] })
  const { data: каналы } = await query.graph({ entity: "sales_channel", fields: ["id"] })

  const { result: заказ } = await createOrderWorkflow(scope).run({
    input: {
      region_id: регионы[0].id,
      sales_channel_id: каналы[0].id,
      currency_code: "rub",
      email: "sklad-test@slytn.ru",
      status: "pending",
      items: количества.map((сколько, и) => ({
        title: `Тест склада ${РАЗМЕРЫ[и % РАЗМЕРЫ.length]}`,
        variant_sku: `TEST-${РАЗМЕРЫ[и % РАЗМЕРЫ.length]}`,
        quantity: сколько,
        unit_price: 10,
        requires_shipping: true,
        is_tax_inclusive: true,
      })),
      shipping_address: {
        first_name: "Тест",
        last_name: "Склада",
        phone: "+79000000000",
        city: "Москва",
        country_code: "ru",
        address_1: "Тестовая, 1",
      },
      shipping_methods: [
        {
          name: способ.name,
          shipping_option_id: способ.id,
          amount: 0,
          data: {
            [ТЕСТ]: true,
            apishipData: {
              point: { id: "test", name: "Тестовый пункт", address: "Москва, Тестовая, 1" },
              tariff: { providerKey: "yataxi", tariffId: 0 },
            },
          },
        },
      ],
      metadata: { [ТЕСТ]: true },
    } as any,
  })

  // Оплата без банка, как у черновиков заказов в админке. Сумму берём из
  // заказа: в ответе на создание итогов ещё нет.
  const { data: созданные } = await query.graph({
    entity: "order",
    fields: ["id", "total"],
    filters: { id: заказ.id },
  })
  const { result: сборы } = await createOrderPaymentCollectionWorkflow(scope).run({
    input: { order_id: заказ.id, amount: Number((созданные?.[0] as any)?.total) },
  })
  await markPaymentCollectionAsPaid(scope).run({
    input: { order_id: заказ.id, payment_collection_id: (сборы as any)[0].id },
  })

  return { id: заказ.id, nomer: String((заказ as any).display_id) }
}
