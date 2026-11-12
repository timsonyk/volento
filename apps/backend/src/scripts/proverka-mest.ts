import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { допУслуги, поПарам } from "../lib/primerka"
import { разложитьПоМестам, type Пакет } from "../lib/sklad-pakety"

/**
 * Проверка заявки из двух мест в ApiShip — без создания заказа.
 *
 *   npx medusa exec ./src/scripts/proverka-mest.ts
 *
 * Собираем такую же заявку, какая уйдёт в службу, когда склад разделит
 * заказ на два пакета (пара с кодом маркировки в каждом, частичный
 * выкуп), и отдаём её в POST /orders/validate: ApiShip проверяет заявку
 * и в службу доставки её не отправляет. Заказов, наклеек и списаний не
 * появляется. Ничего секретного не печатаем.
 */
const { resolveIntegrationOptions } = require("@gorgo/medusa-integration")
const { assembleApishipOptions, assertApishipToken } = require(
  "@gorgo/medusa-fulfillment-apiship/lib/apiship-options"
)
const { createApishipClient } = require("@gorgo/medusa-fulfillment-apiship/lib/client")
// сборщик заявки плагин наружу не отдаёт — берём файлом, рядом с клиентом
const { mapToApishipOrderRequest } = require(
  require("node:path").join(
    require("node:path").dirname(require.resolve("@gorgo/medusa-fulfillment-apiship/lib/client")),
    "../providers/fulfillment-apiship/utils/mapping.js"
  )
)

const К = (n: number) => `010460123456789021PrVrK${n}\u001d93TeSt`

export default async function проверкаМест({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const [склад] = await container
    .resolve(Modules.STOCK_LOCATION)
    .listStockLocations({}, { take: 1, relations: ["address"] })

  const options = assembleApishipOptions(
    // номер подключения — тот же APISHIP_ID, что в medusa-config.ts
    await resolveIntegrationOptions({ identifier: "apiship", instance_id: "apiship-1" })
  )
  assertApishipToken(options)
  const клиент = createApishipClient({ token: options.token, isTest: options.is_test })

  const заказ = {
    id: "order_proverka",
    display_id: 0,
    customer: { email: "proverka@example.com" },
    shipping_address: {
      first_name: "Проверка",
      last_name: "Мест",
      phone: "+79000000000",
      city: "Санкт-Петербург",
      province: "Санкт-Петербург",
      country_code: "ru",
      address_1: "Невский проспект, 1",
      postal_code: "191186",
    },
    items: [
      { id: "s1", title: "Брюки проверочные", quantity: 2, unit_price: 5000, variant: { sku: "PROVERKA-46/170", weight: 450, length: 40, width: 30, height: 4 } },
      { id: "s2", title: "Юбка проверочная", quantity: 1, unit_price: 3000, variant: { sku: "PROVERKA-38", weight: 400, length: 33, width: 30, height: 3 } },
    ],
  }
  const пакеты: Пакет[] = [
    { nomer: 1, sklad: "A", stroki: [{ id: "s1", quantity: 1, kody: [К(1)] }] },
    { nomer: 2, sklad: "B", stroki: [{ id: "s1", quantity: 1, kody: [К(2)] }, { id: "s2", quantity: 1, kody: [К(3)] }] },
  ]
  const коды = new Map([["PROVERKA-46/170", [К(1), К(2)]], ["PROVERKA-38", [К(3)]]])
  const артикулы = new Map([["s1", "PROVERKA-46/170"], ["s2", "PROVERKA-38"]])

  for (const подключение of options.connections ?? []) {
    if (!подключение.is_enabled) continue
    const служба: string = подключение.provider_key
    const тариф = Number((подключение.allowed_point_tariff_ids ?? [])[0])
    if (!тариф) {
      logger.info(`[места] ${служба}: нет тарифа до пункта выдачи, пропускаем`)
      continue
    }

    // любой пункт выдачи этой службы в Петербурге — только чтение справочника
    const { data: пункты } = await клиент.listsApi.getListPoints({
      limit: 1,
      filter: `providerKey=${служба};city=Санкт-Петербург;availableOperation=[2,3];type=1`,
    })
    const пункт = пункты?.rows?.[0]
    if (!пункт) {
      logger.info(`[места] ${служба}: не нашли пункт выдачи, пропускаем`)
      continue
    }

    for (const мест of [1, 2]) {
      const з = mapToApishipOrderRequest(
        options, заказ, склад, служба, тариф, 2,
        подключение.point_in_id ? 2 : 1, Number(пункт.id)
      )
      const [первое] = з.places
      const пары = поПарам(первое.items, коды)
      з.places = мест === 2
        ? разложитьПоМестам(первое, пары, пакеты, артикулы)
        : [{ ...первое, items: пары }]
      let оценка = 0
      for (const место of з.places) {
        for (const п of место.items) {
          п.assessedCost = п.articul.startsWith("PROVERKA-46") ? 5000 : 3000
          оценка += п.assessedCost
        }
      }
      з.cost = { ...з.cost, assessedCost: оценка }
      const услуги = допУслуги(служба, пункт)
      if (услуги.length) з.extraParams = услуги
      з.order.clientNumber = `proverka-${Date.now()}`

      try {
        const { data } = await клиент.ordersApi.validateOrder({ orderRequest: з })
        logger.info(
          `[места] ${служба}, тариф ${тариф}, мест ${мест}, услуги ${JSON.stringify(услуги)}: ${JSON.stringify(data)}`
        )
      } catch (ошибка: any) {
        logger.info(
          `[места] ${служба}, тариф ${тариф}, мест ${мест}: ОТКАЗ ${ошибка?.response?.status ?? ""} ${JSON.stringify(ошибка?.response?.data ?? ошибка?.message).slice(0, 600)}`
        )
      }
    }
  }
}
