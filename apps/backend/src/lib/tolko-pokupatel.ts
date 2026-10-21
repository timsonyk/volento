import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Заказ — только от вошедшего покупателя.
 *
 * У каждого заказа должен быть кабинет: там история, трек и кнопка
 * возврата. Витрина и так не пускает гостя дальше входа, но API открыт
 * всему миру — поэтому то же правило здесь, на трёх дверях к заказу:
 * оплата Точкой, сессия оплаты и оформление корзины.
 *
 * Вошедший — это корзина, привязанная к покупателю с аккаунтом
 * (has_account). Гостевой покупатель, которого Medusa заводит по почте
 * корзины, не считается: войти в его кабинет нельзя.
 *
 * ZAKAZ_BEZ_VHODA=true снимает правило — на случай, если вход сломается,
 * а продавать надо.
 */
export const безВхода = () => process.env.ZAKAZ_BEZ_VHODA === "true"

export const ОШИБКА_ВХОДА = "Чтобы оформить заказ, войдите — пришлём код на почту"

type Найти = (req: MedusaRequest) => Promise<string | null>

async function покупательКорзиныВошёл(req: MedusaRequest, idКорзины: string): Promise<boolean> {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    filters: { id: idКорзины },
    fields: ["id", "customer.id", "customer.has_account"],
  })
  return Boolean((data?.[0] as any)?.customer?.has_account)
}

function пускатьВошедших(найти: Найти) {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    if (безВхода()) {
      return next()
    }

    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

    try {
      const idКорзины = await найти(req)
      // Корзину не нашли — пусть штатный обработчик ответит, что не так
      if (!idКорзины) {
        return next()
      }
      if (!(await покупательКорзиныВошёл(req, idКорзины))) {
        logger.warn(`Заказ без входа отклонён: ${req.method} ${req.path}`)
        return res.status(401).json({ message: ОШИБКА_ВХОДА })
      }
    } catch (ошибка: any) {
      logger.error(`Проверка входа перед заказом не прошла: ${ошибка?.message}`)
      return res.status(500).json({ message: "Не удалось проверить вход" })
    }

    next()
  }
}

/** POST /store/carts/:id/complete */
export const корзинаВошедшего = пускатьВошедших(async (req) => String(req.params?.id ?? "") || null)

/** POST /store/oplata/* — корзина в теле */
export const оплатаВошедшего = пускатьВошедших(
  async (req) => String((req.body as any)?.cart_id ?? "") || null
)

/** POST /store/payment-collections/:id/payment-sessions — корзина через сбор оплаты */
export const сессияВошедшего = пускатьВошедших(async (req) => {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "payment_collection",
    filters: { id: String(req.params?.id ?? "") },
    fields: ["id", "cart.id"],
  })
  return ((data?.[0] as any)?.cart?.id as string) ?? null
})
