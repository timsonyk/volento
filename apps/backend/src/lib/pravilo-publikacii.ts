import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Товар без фотографии или без цены опубликовать нельзя.
 *
 * Почему правилом, а не разовой уборкой: пустая карточка в каталоге —
 * это не разовая оплошность, а то, что повторяется при каждом импорте и
 * при каждой ручной правке. Один раз убрать мало, нужно чтобы не
 * заводилось снова.
 *
 * Стоит на входе в админские ручки товаров: проверяем ровно в тот
 * момент, когда кто-то переводит товар в «опубликован», и отвечаем
 * внятно, что именно не так. Так человек видит причину сразу в админке,
 * а не обнаруживает пустую плашку на витрине.
 *
 * Служебные карточки правило пропускает. Баннер главной — это тоже
 * товар (адрес home-banner, метка system): у него есть снимки, но нет и
 * не должно быть цены, а витрина прячет его из каталога по метке. Под
 * общее правило он не подходит, и снимать его с публикации значит
 * погасить баннер на главной.
 *
 * Чего правило не ловит: публикацию мимо этих ручек — скриптом прямо в
 * базу или чужим воркфлоу. Для таких случаев есть уборка (scripts/
 * snyat-pustye.cjs), она проходит по уже опубликованным.
 */

/** Метка служебных карточек: баннер главной и подобное. */
const СЛУЖЕБНАЯ = "system"

type Разбор = { публикуем: boolean; иды: string[]; тело?: any }

/** Что именно сейчас публикуют: один товар, пачка или новый. */
const разобрать = (req: MedusaRequest): Разбор => {
  const тело = (req.body ?? {}) as any
  const свой = (req.params as any)?.id as string | undefined

  // пачкой: { update: [{ id, status }, ...] }
  if (Array.isArray(тело.update)) {
    const иды = тело.update
      .filter((т: any) => т?.status === "published" && т?.id)
      .map((т: any) => String(т.id))
    return { публикуем: иды.length > 0, иды }
  }

  if (тело.status !== "published") {
    return { публикуем: false, иды: [] }
  }

  // правка существующего
  if (свой) {
    return { публикуем: true, иды: [свой] }
  }

  // создание нового сразу опубликованным — проверяем по телу запроса
  return { публикуем: true, иды: [], тело }
}

/** Чего не хватает новому товару, судя по телу запроса. */
const чегоНеХватаетВТеле = (тело: any): string[] => {
  const нет: string[] = []
  const метки = (тело?.tags ?? []).map((м: any) => м?.value ?? м)
  if (метки.includes(СЛУЖЕБНАЯ)) {
    return нет
  }
  // Обложка считается фотографией: её задают отдельным полем, и товар
  // только с обложкой на витрине выглядит нормально.
  const картинки = тело?.images ?? обложкой(тело)
  if (!Array.isArray(картинки) || !картинки.length) {
    нет.push("фотографии")
  }
  const есть = (тело?.variants ?? []).some((в: any) =>
    (в?.prices ?? []).some((ц: any) => Number(ц?.amount) > 0)
  )
  if (!есть) {
    нет.push("цены")
  }
  return нет
}

const обложкой = (тело: any) => (тело?.thumbnail ? [тело.thumbnail] : [])

export const пускатьТолькоГотовые = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const { публикуем, иды, тело } = разобрать(req)
  if (!публикуем) {
    return next()
  }

  try {
    if (!иды.length && тело) {
      const нет = чегоНеХватаетВТеле(тело)
      if (нет.length) {
        return res.status(400).json({
          type: "invalid_data",
          message: `Нельзя опубликовать: нет ${нет.join(" и ")}. Добавьте и опубликуйте снова.`,
        })
      }
      return next()
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: товары } = await query.graph({
      entity: "product",
      filters: { id: иды },
      fields: ["id", "title", "images.id", "variants.prices.amount", "tags.value"],
    })

    const беда: string[] = []
    for (const т of товары ?? []) {
      if ((т.tags ?? []).some((м: any) => м?.value === СЛУЖЕБНАЯ)) {
        continue
      }
      const нет: string[] = []
      if (!(т.images ?? []).length) нет.push("фотографии")
      const естьЦена = (т.variants ?? []).some((в: any) =>
        (в?.prices ?? []).some((ц: any) => Number(ц?.amount) > 0)
      )
      if (!естьЦена) нет.push("цены")
      if (нет.length) беда.push(`«${т.title}» — нет ${нет.join(" и ")}`)
    }

    if (беда.length) {
      return res.status(400).json({
        type: "invalid_data",
        message:
          беда.length === 1
            ? `Нельзя опубликовать: ${беда[0]}.`
            : `Нельзя опубликовать ${беда.length} товаров:\n${беда.join("\n")}`,
      })
    }

    return next()
  } catch (ошибка: any) {
    // Не смогли проверить — пропускаем: остановить работу админки
    // из-за собственной поломки хуже, чем пропустить пустую карточку,
    // её потом поймает уборка.
    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(`Правило публикации не сработало: ${ошибка?.message}`)
    return next()
  }
}
