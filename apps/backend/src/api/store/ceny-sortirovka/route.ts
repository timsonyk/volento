import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"

/**
 * Цена каждого товара для сортировки каталога «дешевле / дороже».
 *
 * Medusa не умеет сортировать по цене: цена у товара — минимум по его
 * размерам, и считается она с учётом скидок для конкретного региона.
 * Раньше витрина забирала весь каталог с ценами всех размеров и
 * сортировала у себя — это мегабайты и 8 секунд на каждое открытие.
 * Здесь считаем один раз и отдаём только «товар → цена».
 *
 * Держим пять минут. Когда срок вышел, сразу отдаём прежний ответ и
 * пересчитываем в фоне: ждать пересчёта никому не приходится.
 */
const ДЕРЖИМ_МС = 5 * 60_000

type Запись = { когда: number; ceny: Record<string, number>; считаем?: Promise<void> }

const поРегиону = new Map<string, Запись>()

const посчитать = async (req: MedusaRequest, regionId: string, валюта: string) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: товары } = await query.graph({
    entity: "product",
    fields: ["id", "variants.calculated_price.calculated_amount"],
    filters: { status: "published" },
    pagination: { take: 100_000 },
    context: {
      variants: {
        calculated_price: QueryContext({ region_id: regionId, currency_code: валюта }),
      },
    },
  })

  const ceny: Record<string, number> = {}
  for (const т of товары as any[]) {
    const цены = (т.variants ?? [])
      .map((в: any) => в?.calculated_price?.calculated_amount)
      .filter((ц: unknown) => typeof ц === "number")
    if (цены.length) {
      ceny[т.id] = Math.min(...цены)
    }
  }

  поРегиону.set(regionId, { когда: Date.now(), ceny })
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const regionId = String(req.query.region_id ?? "")

  if (!/^reg_[A-Za-z0-9]+$/.test(regionId)) {
    return res.status(400).json({ message: "Не указан регион" })
  }

  try {
    const было = поРегиону.get(regionId)

    if (было && Date.now() - было.когда < ДЕРЖИМ_МС) {
      return res.json({ ceny: было.ceny })
    }

    const {
      data: [регион],
    } = await query.graph({
      entity: "region",
      fields: ["currency_code"],
      filters: { id: regionId },
    })

    if (!регион) {
      return res.status(404).json({ message: "Регион не найден" })
    }

    if (было) {
      // Устарело — отдаём что есть, пересчитываем в фоне (один раз)
      if (!было.считаем) {
        было.считаем = посчитать(req, regionId, регион.currency_code)
          .catch((e) => logger.error(`Цены для сортировки не пересчитались — ${e?.message}`))
          .finally(() => {
            было.считаем = undefined
          })
      }
      return res.json({ ceny: было.ceny })
    }

    await посчитать(req, regionId, регион.currency_code)
    return res.json({ ceny: поРегиону.get(regionId)!.ceny })
  } catch (ошибка: any) {
    logger.error(`Цены для сортировки не посчитались — ${ошибка?.message}`)
    return res.status(500).json({ message: "Не удалось посчитать цены" })
  }
}
