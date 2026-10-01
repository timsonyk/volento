"use server"

import { sdk } from "@lib/config"
import { OptionValueIds } from "@lib/util/product-option-filters"
import { дляКарточки } from "@lib/util/dlya-kartochki"
import { sortProducts } from "@lib/util/sort-products"
import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { ModelColor } from "types/global"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { getRegion, retrieveRegion } from "./regions"

// Метка служебных записей (баннер главной). Не экспортируем: файл помечен
// "use server", там разрешены только асинхронные функции.
const SYSTEM_TAG = "system"

// Метка скрытых товаров: в каталоге, поиске и на главной их нет, но
// страница по прямой ссылке открывается (у system — нет). Так живёт
// «Проверка оплаты» за 10 ₽ до открытия магазина.
const HIDDEN_TAG = "skryt"

type ProductListQueryParams = (HttpTypes.FindParams &
  HttpTypes.StoreProductListParams) & {
  options?: string[]
  option_value_id?: string | string[]
}

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
  сСкрытыми = false,
}: {
  pageParam?: number
  queryParams?: ProductListQueryParams
  countryCode?: string
  regionId?: string
  /**
   * Не отсеивать товары с меткой skryt. Только для страницы самого
   * товара: в списки скрытые попадать не должны.
   */
  сСкрытыми?: boolean
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: ProductListQueryParams
}> => {
  if (!countryCode && !regionId) {
    throw new Error("Country code or region ID is required")
  }

  const limit = queryParams?.limit || 12
  const _pageParam = Math.max(pageParam, 1)
  const offset = _pageParam === 1 ? 0 : (_pageParam - 1) * limit

  let region: HttpTypes.StoreRegion | undefined | null

  if (countryCode) {
    region = await getRegion(countryCode)
  } else {
    region = await retrieveRegion(regionId!)
  }

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("products")),
  }

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      `/store/products`,
      {
        method: "GET",
        query: {
          limit,
          offset,
          region_id: region?.id,
          fields:
            "*variants.calculated_price,+variants.inventory_quantity,*variants.images,*variants.options,+metadata,+tags,",
          ...queryParams,
        },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ products, count }) => {
      // Служебные записи (баннер главной) хранятся товарами, чтобы их можно
      // было менять из админки. В каталоге им делать нечего — прячем везде,
      // кроме запроса по конкретному handle, которым их и достают.
      const visible = queryParams?.handle
        ? products
        : products.filter(
            (p) =>
              !p.tags?.some(
                (t) =>
                  t.value === SYSTEM_TAG ||
                  (!сСкрытыми && t.value === HIDDEN_TAG)
              )
          )
      const hidden = products.length - visible.length

      const nextPage = count > offset + limit ? pageParam + 1 : null

      return {
        response: {
          products: visible,
          count: count - hidden,
        },
        nextPage: nextPage,
        queryParams,
      }
    })
}

/**
 * Минимальная цена каждого товара в регионе страны (бэкенд,
 * /store/ceny-sortirovka). null — бэкенд не ответил.
 */
const ценыДляСортировки = async (
  countryCode: string
): Promise<Record<string, number> | null> => {
  try {
    const region = await getRegion(countryCode)
    if (!region) return null
    const { ceny } = await sdk.client.fetch<{ ceny: Record<string, number> }>(
      "/store/ceny-sortirovka",
      { method: "GET", query: { region_id: region.id }, next: { revalidate: 300 } }
    )
    return ceny
  } catch (e) {
    console.error("Цены для сортировки не получены", e)
    return null
  }
}

/**
 * This will fetch 100 products to the Next.js cache and sort them based on the sortBy parameter.
 * It will then return the paginated products based on the page and limit parameters.
 */
export const listProductsWithSort = async ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
  optionValueIds,
}: {
  page?: number
  queryParams?: ProductListQueryParams
  sortBy?: SortOptions
  countryCode: string
  optionValueIds?: OptionValueIds
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: ProductListQueryParams
}> => {
  const limit = queryParams?.limit || 12
  const optionFilters = Array.from(
    new Set((optionValueIds || []).filter(Boolean))
  )
  const общие = {
    ...queryParams,
    ...(optionFilters.length ? { option_value_id: optionFilters } : {}),
  }

  // Отобранные фильтром товары уезжают на сервер списком id прямо в
  // адресе запроса. Список длинный: «Осень-зима» — это 226 товаров, а
  // находки по слову «палаццо» — 153, и адрес перестаёт помещаться —
  // сервер отвечает «Request-URI Too Large», страница падает.
  //
  // Поэтому отправляем не весь список, а только ту его часть, которая
  // нужна: список у нас уже в правильном порядке, так что страницу из
  // него можно отрезать самим.
  const ПРЕДЕЛ_ID = 100
  const всеИды = Array.isArray(общие.id) ? (общие.id as string[]) : undefined

  // «Новинки» — сортировка по дате, её умеет сам сервер. Тогда просим
  // ровно страницу: на боевом каталоге сотня товаров со всеми вариантами
  // весила 17,9 МБ и считалась 4,4 секунды, страница из двенадцати —
  // 1,8 МБ и полсекунды.
  if (sortBy === "created_at") {
    if (всеИды && всеИды.length > ПРЕДЕЛ_ID) {
      const начало = Math.max(page - 1, 0) * limit
      const страница = всеИды.slice(начало, начало + limit)

      const {
        response: { products },
      } = await listProducts({
        pageParam: 1,
        queryParams: { ...общие, id: страница, order: "-created_at", limit },
        countryCode,
      })

      const дальше = начало + limit < всеИды.length ? page + 1 : null

      return {
        response: { products, count: всеИды.length },
        nextPage: дальше,
        queryParams,
      }
    }

    const { response, nextPage } = await listProducts({
      pageParam: page,
      queryParams: { ...общие, order: "-created_at", limit },
      countryCode,
    })

    return { response, nextPage, queryParams }
  }

  // Сортировка по цене так не работает: цена у товара — минимум по его
  // вариантам, сервер по ней упорядочить не может. Приходится забирать
  // список целиком, но без картинок и опций вариантов — в сетке каталога
  // они не нужны, а вес ответа это режет вдвое.
  // Отбор по id есть почти всегда (распроданное прячем). Тогда цены
  // берём готовыми у бэкенда — «товар → цена», — сортируем id сами и
  // просим только карточки нужной страницы.
  if (всеИды && (sortBy === "price_asc" || sortBy === "price_desc")) {
    const ceny = await ценыДляСортировки(countryCode)

    if (ceny) {
      // Товары без цены — в конец при любом направлении: «дороже всех»
      // их ставить так же неверно, как «дешевле всех»
      const порядок = [...всеИды].sort((a, b) => {
        const ца = ceny[a]
        const цб = ceny[b]
        if (ца === undefined || цб === undefined) {
          return (ца === undefined ? 1 : 0) - (цб === undefined ? 1 : 0)
        }
        return sortBy === "price_asc" ? ца - цб : цб - ца
      })
      const начало = Math.max(page - 1, 0) * limit
      const страница = порядок.slice(начало, начало + limit)

      const {
        response: { products },
      } = await listProducts({
        pageParam: 1,
        queryParams: { ...общие, id: страница, limit },
        countryCode,
      })

      const место = new Map(страница.map((id, i) => [id, i]))
      products.sort((a, b) => (место.get(a.id) ?? 0) - (место.get(b.id) ?? 0))

      return {
        response: { products, count: порядок.length },
        nextPage: начало + limit < порядок.length ? page + 1 : null,
        queryParams,
      }
    }
  }

  // Запасной путь, если бэкенд цен не дал: сравниваем у всех сразу,
  // страницу отрезать нельзя. Длинный
  // список id (а с отсевом распроданного он длинный почти всегда)
  // режем на куски, которые помещаются в адрес, и просим их разом.
  const куски: (string[] | undefined)[] = []
  if (всеИды && всеИды.length > ПРЕДЕЛ_ID) {
    for (let i = 0; i < всеИды.length; i += ПРЕДЕЛ_ID) {
      куски.push(всеИды.slice(i, i + ПРЕДЕЛ_ID))
    }
  } else {
    куски.push(undefined)
  }

  const ответы = await Promise.all(
    куски.map((кусок) =>
      listProducts({
        pageParam: 0,
        queryParams: {
          ...общие,
          ...(кусок ? { id: кусок } : {}),
          fields: "*variants.calculated_price,+metadata,+tags,",
          limit: кусок ? кусок.length : 100,
        },
        countryCode,
      })
    )
  )
  const products = ответы.flatMap((о) => о.response.products)

  const sortedProducts = sortProducts(products, sortBy)

  const pageParam = (page - 1) * limit

  const filteredCount = products.length

  const nextPage = filteredCount > pageParam + limit ? pageParam + limit : null

  const paginatedProducts = sortedProducts.slice(pageParam, pageParam + limit)

  return {
    response: {
      products: paginatedProducts,
      count: filteredCount,
    },
    nextPage,
    queryParams,
  }
}

/**
 * Собирает цвета моделей для карточек каталога.
 *
 * Цвет у нас — отдельный товар, связанный с остальными меткой model:<код>.
 * Чтобы не делать запрос на каждую карточку, берём метки всех товаров
 * страницы и вытягиваем их цвета одним запросом.
 */
export const listModelColors = async ({
  products,
  countryCode,
}: {
  products: HttpTypes.StoreProduct[]
  countryCode: string
}): Promise<Record<string, ModelColor[]>> => {
  const tagIds = Array.from(
    new Set(
      products.flatMap((p) =>
        (p.tags ?? [])
          .filter((t) => t.value?.startsWith("model:"))
          .map((t) => t.id!)
          .filter(Boolean)
      )
    )
  )

  if (!tagIds.length) {
    return {}
  }

  const {
    response: { products: siblings },
  } = await listProducts({
    countryCode,
    queryParams: { tag_id: tagIds, limit: 100 } as ProductListQueryParams,
  })

  const byModel: Record<string, ModelColor[]> = {}

  for (const p of siblings) {
    const model = p.metadata?.model as string | undefined
    const color = p.metadata?.color as string | undefined

    if (!model || !color) {
      continue
    }

    byModel[model] ??= []
    byModel[model].push({
      id: p.id!,
      handle: p.handle ?? "",
      color,
      hex: (p.metadata?.color_hex as string) || "#e5e5e5",
    })
  }

  return byModel
}

/**
 * Отдаёт следующую страницу каталога кнопке «Показать ещё».
 *
 * Возвращает сразу и товары, и цвета их моделей: иначе браузеру
 * пришлось бы ходить на сервер дважды, и кружки цветов появлялись бы
 * позже самих карточек.
 */
export const следующаяСтраницаТоваров = async ({
  page,
  queryParams,
  sortBy,
  countryCode,
  optionValueIds,
}: {
  page: number
  queryParams?: ProductListQueryParams
  sortBy?: SortOptions
  countryCode: string
  optionValueIds?: OptionValueIds
}): Promise<{
  products: HttpTypes.StoreProduct[]
  colorsByModel: Record<string, ModelColor[]>
  естьЕщё: boolean
}> => {
  const {
    response: { products, count },
  } = await listProductsWithSort({
    page,
    queryParams,
    sortBy,
    countryCode,
    optionValueIds,
  })

  const colorsByModel = await listModelColors({ products, countryCode })
  const показано = page * (queryParams?.limit || 12)

  return {
    products: products.map(дляКарточки),
    colorsByModel,
    естьЕщё: показано < count,
  }
}
