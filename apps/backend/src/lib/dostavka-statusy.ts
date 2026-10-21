import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { итогиЗаказа, подвестиИтог } from "./dostavka-itog"
import { БЕДА, ЧАСТИЧНО, итоговый, итогВыдачи, товарыОтвета } from "./primerka"
import { КОДЫ } from "./sklad-kody"
import { этоТест } from "./sklad-test-metka"
import { позвать } from "./trevoga"

const { resolveIntegrationOptions } = require("@gorgo/medusa-integration")
const {
  assembleApishipOptions,
  assertApishipToken,
} = require("@gorgo/medusa-fulfillment-apiship/lib/apiship-options")
const { Configuration, OrdersApi, StatusesApi } = require("@gorgo/medusa-fulfillment-apiship/lib/apiship-client/index")

/**
 * Где посылка: статусы ApiShip по упакованным, но ещё не выданным
 * сборкам. Итог выдачи подводит lib/dostavka-itog.ts.
 *
 * Вебхуками ApiShip не пользуемся: после десяти неудачных доставок подряд
 * он молча отключает их все, а опрос раз в четверть часа ничего не
 * теряет — посылки в пункте лежат неделю.
 */
const ЗАВИС_ДНЕЙ = Number(process.env.DOSTAVKA_ZAVIS_DNEY || 21)

const ПОЛЯ = [
  "id",
  "data",
  "shipped_at",
  "items.line_item_id",
  "items.quantity",
  "order.id",
  "order.display_id",
  "order.metadata",
  "order.items.id",
  "order.items.variant_sku",
]

/** Строки сборки с кодами — то, о чём спрашиваем службу. */
export function строкиСборки(сборка: any) {
  const заказ = сборка.order ?? {}
  const коды: Record<string, string[]> = (заказ.metadata ?? {})[КОДЫ] ?? {}
  const артикулы = new Map<string, string>((заказ.items ?? []).map((с: any) => [с.id, с.variant_sku]))
  const штук = new Map<string, number>()

  for (const п of сборка.items ?? []) {
    штук.set(п.line_item_id, (штук.get(п.line_item_id) ?? 0) + Number(п.quantity ?? 0))
  }

  // если строку отправляли в два приёма, у этой сборки — последние коды
  return [...штук].map(([id, n]) => ({
    id,
    artikul: артикулы.get(id) ?? null,
    kody: (коды[id] ?? []).slice(-n),
    shtuk: n,
  }))
}

export async function упакованныеНеВыданные(scope: MedusaContainer, idСборки?: string) {
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "fulfillment",
    fields: ПОЛЯ,
    filters: {
      ...(idСборки ? { id: idСборки } : {}),
      shipped_at: { $ne: null },
      delivered_at: null,
      canceled_at: null,
    } as any,
    pagination: { order: { shipped_at: "ASC" }, take: 500 } as any,
  })
  return ((data ?? []) as any[]).filter((с) => с.order)
}

async function клиент(сборка: any) {
  const options = assembleApishipOptions(
    await resolveIntegrationOptions({
      identifier: "apiship",
      instance_id: сборка.data?.instanceId ?? null,
    })
  )
  assertApishipToken(options)
  const configuration = new Configuration({
    basePath: options.is_test ? "http://api.dev.apiship.ru/v1" : "https://api.apiship.ru/v1",
    apiKey: options.token,
    baseOptions: { headers: { platform: "medusajs" } },
  })
  return { статусы: new StatusesApi(configuration), заказы: new OrdersApi(configuration) }
}

export async function проверитьДоставку(scope: MedusaContainer) {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
  const сборки = await упакованныеНеВыданные(scope)

  for (const сборка of сборки) {
    const заказ: any = сборка.order
    const итог = итогиЗаказа(заказ)[сборка.id]

    try {
      // итог уже есть, но не доведён (упали посередине) — доводим
      if (итог) {
        if (итог.etap !== "gotovo") {
          await подвестиИтог(scope, заказ.id, сборка.id, итог.status)
        }
        continue
      }

      // тестовые посылки в службу не уходили — их «выдаёт» /sklad/proba/vydacha
      if (сборка.data?.test || этоТест(заказ)) {
        continue
      }

      const idApiship = сборка.data?.orderId
      if (!idApiship) {
        continue
      }

      const api = await клиент(сборка)
      const { data: ответ } = await api.статусы.getOrderStatus({ orderId: idApiship })
      const статус: string = ответ?.status?.key ?? ""

      if (итоговый(статус)) {
        const товары =
          статус === ЧАСТИЧНО ? товарыОтвета((await api.заказы.getOrderInfo({ orderId: idApiship })).data) : []
        const новый = итогВыдачи(статус, строкиСборки(сборка), товары)

        if (новый) {
          await подвестиИтог(scope, заказ.id, сборка.id, статус, новый)
        } else {
          await позватьОдинРаз(scope, заказ, сборка.id, "neyasno", {
            тема: `Заказ ${заказ.display_id}: выдан частично, но служба не сказала что`,
            текст: `Посмотрите выдачу в кабинете ApiShip и напишите мне, какие пары забрали: чек и возврат денег пока не сделаны.`,
          })
        }
        continue
      }

      if (БЕДА.has(статус)) {
        await позватьОдинРаз(scope, заказ, сборка.id, статус, {
          тема: `Заказ ${заказ.display_id}: ${статус === "lost" ? "посылка утеряна" : "проблема с доставкой"}`,
          текст: `Служба сообщила: ${ответ?.status?.name ?? статус}${ответ?.status?.providerName ? ` (${ответ.status.providerName})` : ""}. Посмотрите посылку в кабинете ApiShip.`,
        })
        continue
      }

      const дней = (Date.now() - new Date(сборка.shipped_at).getTime()) / 86_400_000
      if (дней > ЗАВИС_ДНЕЙ) {
        await позватьОдинРаз(scope, заказ, сборка.id, "zavis", {
          тема: `Заказ ${заказ.display_id}: посылка в пути уже ${Math.round(дней)} дн.`,
          текст: `Последний статус: ${ответ?.status?.name ?? статус ?? "неизвестен"}. Чек «полный расчёт» пробьётся, только когда служба скажет, что заказ выдан.`,
        })
      }
    } catch (ошибка: any) {
      logger.error(`Доставка заказа ${заказ.display_id}: статус не узнали — ${ошибка?.message}`)
    }
  }
}

/** Позвать по сборке один раз на каждый повод. */
async function позватьОдинРаз(
  scope: MedusaContainer,
  заказ: any,
  idСборки: string,
  повод: string,
  письмо: { тема: string; текст: string }
) {
  const было = (заказ.metadata ?? {}).dostavka_trevogi ?? {}
  if (было[`${idСборки}:${повод}`]) {
    return
  }
  await позвать(scope, письмо)
  const orderModule = scope.resolve(Modules.ORDER)
  const [свежий] = await orderModule.listOrders({ id: заказ.id }, { select: ["id", "metadata"] })
  await orderModule.updateOrders([
    {
      id: заказ.id,
      metadata: {
        ...(свежий.metadata ?? {}),
        dostavka_trevogi: { ...((свежий.metadata ?? {}).dostavka_trevogi ?? {}), [`${idСборки}:${повод}`]: new Date().toISOString() },
      },
    },
  ])
}
