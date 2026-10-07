import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils"
import {
  createOrderPaymentCollectionWorkflow,
  createOrderWorkflow,
  createProductsWorkflow,
  markPaymentCollectionAsPaid,
} from "@medusajs/medusa/core-flows"

import { ТЕСТ } from "./sklad-test-metka"

/**
 * Тестовые заказы для склада — проверить обмен целиком, ничего не
 * отправляя на самом деле.
 *
 * Тестовый заказ:
 * - оплачен «системной» оплатой Medusa, без банка — возврат тоже без банка;
 * - из скрытого товара «Тест склада» без учёта остатков — настоящие
 *   остатки не трогает;
 * - отправление по нему в службу не уходит: провайдер доставки видит
 *   отметку в способе доставки и выдаёт поддельный трек и наклейку
 *   (modules/dostavka-apiship);
 * - в обычных списках склада его нет, только с ?test=1; сторож о нём
 *   молчит.
 *
 * Дальше он проходит те же ручки, что и настоящий: «собираю», «собрано»
 * с кодами, «к упаковке», наклейка, «упаковано», отказ, нехватка.
 */

const ТОВАР = "sklad-test"
const РАЗМЕРЫ = [
  ["46", "170"],
  ["48", "176"],
  ["50", "182"],
]

async function тестовыйТовар(scope: MedusaContainer, профиль: string, канал: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const найти = async () =>
    (
      await query.graph({
        entity: "product",
        fields: ["id", "variants.id", "variants.sku"],
        filters: { handle: ТОВАР },
      })
    ).data?.[0]

  const есть = await найти()
  if (есть) {
    return есть.variants as { id: string; sku: string }[]
  }

  // Черновик: на витрине его не видно, а заказ из него собрать можно
  await createProductsWorkflow(scope).run({
    input: {
      products: [
        {
          title: "Тест склада",
          handle: ТОВАР,
          status: ProductStatus.DRAFT,
          shipping_profile_id: профиль,
          sales_channels: [{ id: канал }],
          options: [{ title: "Размер", values: РАЗМЕРЫ.map(([р, рост]) => `${р}/${рост}`) }],
          variants: РАЗМЕРЫ.map(([р, рост]) => ({
            title: `${р}/${рост}`,
            sku: `TEST-${р}/${рост}`,
            manage_inventory: false,
            weight: 400,
            length: 33,
            width: 30,
            height: 3,
            options: { Размер: `${р}/${рост}` },
            prices: [{ amount: 10, currency_code: "rub" }],
          })),
        },
      ],
    },
  })

  return ((await найти())?.variants ?? []) as { id: string; sku: string }[]
}

/** kolichestva — по строке на число: [3] — одна строка, 3 шт.; [2, 1] — две. */
export async function создатьТестовыйЗаказ(scope: MedusaContainer, количества: number[]) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: способы } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "shipping_profile_id"],
    filters: { provider_id: "apiship_apiship" } as any,
  })
  const способ: any = способы?.[0]
  if (!способ) {
    throw new Error("Нет способа доставки ApiShip")
  }

  const { data: регионы } = await query.graph({ entity: "region", fields: ["id"] })
  const { data: каналы } = await query.graph({ entity: "sales_channel", fields: ["id"] })

  const варианты = await тестовыйТовар(scope, способ.shipping_profile_id, каналы[0].id)

  const { result: заказ } = await createOrderWorkflow(scope).run({
    input: {
      region_id: регионы[0].id,
      sales_channel_id: каналы[0].id,
      currency_code: "rub",
      email: "sklad-test@slytn.ru",
      status: "pending",
      items: количества.map((сколько, и) => ({
        variant_id: варианты[и % варианты.length].id,
        quantity: сколько,
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

  // Оплата без банка, как у черновиков заказов в админке
  const { result: сборы } = await createOrderPaymentCollectionWorkflow(scope).run({
    input: { order_id: заказ.id, amount: Number((заказ as any).total ?? 0) || 10 },
  })
  await markPaymentCollectionAsPaid(scope).run({
    input: { order_id: заказ.id, payment_collection_id: (сборы as any)[0].id },
  })

  return { id: заказ.id, nomer: String((заказ as any).display_id) }
}
