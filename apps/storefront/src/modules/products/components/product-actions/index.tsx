"use client"

import { addToCart } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ТаблицаРазмеров from "@modules/products/components/tablica-razmerov"
import { isEqual } from "lodash"
import { useParams, usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import ProductPrice from "../product-price"
import СообщитьОПоступлении from "./zhdu"
import { useRouter } from "next/navigation"
import { сообщитьОКорзине } from "@lib/util/sobytie-korziny"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
  /** снимки таблицы мерок — кнопка «Таблица размеров» у выбора размера */
  таблицы?: string[]
}

const КЛЮЧ_РАЗМЕРА = "volento_moy_razmer"

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt) => {
    if (varopt.option_id) acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}

export default function ProductActions({
  product,
  disabled,
  таблицы,
}: ProductActionsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [isAdding, setIsAdding] = useState(false)
  const [ошибка, setОшибка] = useState<string | null>(null)
  // «Мой размер»: что подставили сами, чтобы сказать об этом покупателю
  const [подставлен, setПодставлен] = useState<string | null>(null)
  const countryCode = useParams().countryCode as string

  // If there is only 1 variant, preselect the options
  useEffect(() => {
    if (product.variants?.length === 1) {
      const variantOptions = optionsAsKeymap(product.variants[0].options)
      setOptions(variantOptions ?? {})
    }
  }, [product.variants])

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }

    return product.variants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  // update the options when a variant is selected
  const setOptionValue = (optionId: string, value: string) => {
    setПодставлен(null)
    запомнитьРазмер(optionId, value)
    setOptions((prev) => ({
      ...prev,
      [optionId]: value,
    }))
  }

  //check if the selected options produce a valid variant
  const isValidVariant = useMemo(() => {
    return product.variants?.some((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    const value = isValidVariant ? selectedVariant?.id : null

    if (params.get("v_id") === value) {
      return
    }

    if (value) {
      params.set("v_id", value)
    } else {
      params.delete("v_id")
    }

    // Только адрес в строке браузера, без похода на сервер: router.replace
    // перерисовывал всю страницу и на телефоне бросал наверх при каждом
    // выборе размера. Размеры одного цвета снимаются одинаково, так что
    // перерисовывать галерею незачем.
    window.history.replaceState(null, "", pathname + "?" + params.toString())
  }, [selectedVariant, isValidVariant])

  // check if the selected variant is in stock
  const inStock = useMemo(() => {
    // If we don't manage inventory, we can always add to cart
    if (selectedVariant && !selectedVariant.manage_inventory) {
      return true
    }

    // If we allow back orders on the variant, we can add to cart
    if (selectedVariant?.allow_backorder) {
      return true
    }

    // If there is inventory available, we can add to cart
    if (
      selectedVariant?.manage_inventory &&
      (selectedVariant?.inventory_quantity || 0) > 0
    ) {
      return true
    }

    // Otherwise, we can't add to cart
    return false
  }, [selectedVariant])

  /**
   * Что есть в наличии.
   *
   * Размер перечёркнут, если ни в одном росте его нет. Если хоть один
   * рост есть — размер живой, а перечёркнутыми окажутся те роста,
   * которых нет именно в этом размере.
   */
  const наличие = useMemo(() => {
    const найти = (имя: string) =>
      (product.options ?? []).find(
        (o) => (o.title ?? "").trim().toLowerCase() === имя
      )?.id

    const размерId = найти("размер")
    const ростId = найти("рост")

    const размеры = new Set<string>()
    const ростаУРазмера = new Map<string, Set<string>>()
    const всеРоста = new Set<string>()

    for (const v of product.variants ?? []) {
      const есть = v.manage_inventory
        ? (v.inventory_quantity ?? 0) > 0 || !!v.allow_backorder
        : true
      if (!есть) {
        continue
      }

      const карта = optionsAsKeymap(v.options) ?? {}
      const размер = размерId ? карта[размерId] : undefined
      const рост = ростId ? карта[ростId] : undefined

      if (размер) {
        размеры.add(размер)
        if (рост) {
          const набор = ростаУРазмера.get(размер) ?? new Set<string>()
          набор.add(рост)
          ростаУРазмера.set(размер, набор)
        }
      }
      if (рост) {
        всеРоста.add(рост)
      }
    }

    return { размерId, ростId, размеры, ростаУРазмера, всеРоста }
  }, [product.variants, product.options])

  /**
   * «Мой размер». Размер и рост у человека одни и те же во всех брюках,
   * а выбирать их приходилось в каждой карточке заново. Запоминаем
   * последний выбор в браузере и подставляем в следующей вещи — только
   * если такой размер (и рост) у неё есть в наличии.
   */
  /**
   * Размер запоминаем отдельно по видам вещей: 46 в брюках не значит 46
   * в блузке, а мужская сетка своя. Вид берём из разделов каталога.
   */
  const вид = useMemo(() => {
    const разделы = (product.categories ?? []).map((c) => c.handle ?? "")
    const верх = разделы.some((h) => /bluzk|rubashk/.test(h))
    const мужское = разделы.some((h) => h.startsWith("muzhsk"))
    return `${мужское ? "muzh-" : ""}${верх ? "verh" : "niz"}`
  }, [product.categories])

  type Запись = { размер?: string; рост?: string }
  const прочитатьРазмеры = (): Record<string, Запись> => {
    const было = JSON.parse(localStorage.getItem(КЛЮЧ_РАЗМЕРА) || "{}")
    // первая версия хранила один размер на всё; тогда это были брюки
    if (typeof было.размер === "string" || typeof было.рост === "string") {
      return { niz: { размер: было.размер, рост: было.рост } }
    }
    return было && typeof было === "object" ? было : {}
  }

  const запомнитьРазмер = (optionId: string, value: string) => {
    const поле =
      optionId === наличие.размерId
        ? "размер"
        : optionId === наличие.ростId
        ? "рост"
        : null
    if (!поле) return
    try {
      const все = прочитатьРазмеры()
      localStorage.setItem(
        КЛЮЧ_РАЗМЕРА,
        JSON.stringify({ ...все, [вид]: { ...все[вид], [поле]: value } })
      )
    } catch {
      // браузер без хранилища — просто не запоминаем
    }
  }

  useEffect(() => {
    if ((product.variants?.length ?? 0) <= 1 || !наличие.размерId) return
    let мой: Запись = {}
    try {
      мой = прочитатьРазмеры()[вид] ?? {}
    } catch {
      return
    }
    if (!мой.размер || !наличие.размеры.has(мой.размер)) return

    const выбор: Record<string, string> = { [наличие.размерId]: мой.размер }
    let подпись = `размер ${мой.размер}`
    if (
      наличие.ростId &&
      мой.рост &&
      наличие.ростаУРазмера.get(мой.размер)?.has(мой.рост)
    ) {
      выбор[наличие.ростId] = мой.рост
      подпись += `, рост ${мой.рост}`
    }
    setOptions((prev) => (Object.keys(prev).length ? prev : выбор))
    setПодставлен(подпись)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id])

  /** Значения, которые надо перечеркнуть у конкретной опции. */
  const перечеркнуть = (id: string, значения: string[]) => {
    if (id === наличие.размерId) {
      return new Set(значения.filter((v) => !наличие.размеры.has(v)))
    }
    if (id === наличие.ростId) {
      // размер уже выбран — смотрим роста именно для него
      const выбранныйРазмер = наличие.размерId
        ? options[наличие.размерId]
        : undefined
      const доступные = выбранныйРазмер
        ? (наличие.ростаУРазмера.get(выбранныйРазмер) ?? new Set<string>())
        : наличие.всеРоста
      return new Set(значения.filter((v) => !доступные.has(v)))
    }
    return undefined
  }

  // add the selected variant to the cart
  // размеры одного товара обычно стоят одинаково; тогда цену показывает
  // только блок под названием
  const ценыРазные =
    new Set(
      (product.variants ?? [])
        .map((v) => v.calculated_price?.calculated_amount)
        .filter((c) => typeof c === "number")
    ).size > 1

  const нельзяКупить =
    !inStock || !selectedVariant || !!disabled || !isValidVariant

  /**
   * Кладём в корзину. Две вещи, которых раньше не было:
   *
   * - после успеха просим сервер перерисовать страницу заново. Ответ на
   *   добавление иногда приносил шапку со старой корзиной: вещь уже лежала
   *   в корзине, а значок показывал ноль, и человек нажимал второй раз;
   * - ошибку показываем под кнопкой, а не роняем молча: раньше кнопка так
   *   и крутилась, а покупатель не знал, что случилось.
   */
  const положить = async (): Promise<boolean> => {
    if (!selectedVariant?.id) return false

    setIsAdding(true)
    setОшибка(null)
    try {
      await addToCart({
        variantId: selectedVariant.id,
        quantity: 1,
        countryCode,
      })
      router.refresh()
      сообщитьОКорзине()
      return true
    } catch (e) {
      setОшибка(
        // английский текст сервера покупателю не показываем
        e instanceof Error && /[а-яё]/i.test(e.message)
          ? `Не получилось добавить в корзину: ${e.message}`
          : "Не получилось добавить в корзину. Попробуйте ещё раз."
      )
      return false
    } finally {
      setIsAdding(false)
    }
  }

  const handleAddToCart = async () => {
    await положить()
  }

  // «Купить сейчас» — та же покупка, только без остановки в корзине:
  // кладём вещь и сразу ведём к оформлению
  const handleBuyNow = async () => {
    if (await положить()) {
      router.push(`/${countryCode}/checkout?step=address`)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-y-6">
        <div>
          {(product.variants?.length ?? 0) > 1 && (
            <div className="flex flex-col gap-y-4">
              {(product.options || []).map((option) => {
                return (
                  <div key={option.id}>
                    <OptionSelect
                      option={option}
                      current={options[option.id]}
                      updateOption={setOptionValue}
                      title={option.title ?? ""}
                      нет={перечеркнуть(
                        option.id,
                        (option.values ?? []).map((v) => v.value)
                      )}
                      data-testid="product-options"
                      disabled={!!disabled || isAdding}
                      рядом={
                        (option.title ?? "").trim().toLowerCase() === "размер" ? (
                          <ТаблицаРазмеров таблицы={таблицы ?? []} />
                        ) : undefined
                      }
                    />
                  </div>
                )
              })}
              {подставлен && (
                <p className="text-sm text-muted" data-testid="moy-razmer">
                  Подставили ваш прошлый выбор: {подставлен}. Его можно сменить.
                </p>
              )}
              {/* Образец идеи (ждёт решения Тимофея): примерка в пункте
                  выдачи уже работает, но на странице товара о ней ни слова */}
              <p className="border-l-2 border-ink pl-3 text-sm leading-snug text-ink" data-testid="dva-razmera">
                Сомневаетесь в размере? Закажите два, примерьте в пункте
                выдачи и заберите тот, что подошёл. За второй вернём деньги.{" "}
                <LocalizedClientLink href="/dostavka" className="underline">
                  Как это работает
                </LocalizedClientLink>
              </p>
            </div>
          )}
        </div>

        {/* Цена размера показывается здесь, только если размеры стоят
            по-разному: обычная цена уже стоит под названием, и повторять
            её вторым разом ни к чему. */}
        {ценыРазные && (
          <ProductPrice product={product} variant={selectedVariant} />
        )}

        {/* Две кнопки в ряд, как на референсе: обычная покупка и покупка
            без захода в корзину. На телефоне они встают друг под друга —
            в строку не помещаются. */}
        <div className="flex flex-col gap-2 small:flex-row">
          <Button
            onClick={handleAddToCart}
            disabled={нельзяКупить || isAdding}
            variant="primary"
            className="h-14 w-full"
            isLoading={isAdding}
            data-testid="add-product-button"
          >
            {/* options это объект, поэтому !options всегда false: без этой правки
                до выбора размера кнопка показывала "Нет в наличии" */}
            {/* Просим выбрать ровно то, что у товара есть: у блуз,
                юбок и рубашек роста нет, и звать его незачем. */}
            {!selectedVariant || !isValidVariant
              ? `Выберите ${(product.options ?? [])
                  .map((о) => (о.title ?? "").toLowerCase())
                  .filter(Boolean)
                  .join(" и ") || "вариант"}`
              : !inStock
              ? "Нет в наличии"
              : "В корзину"}
          </Button>

          <Button
            onClick={handleBuyNow}
            disabled={нельзяКупить || isAdding}
            variant="secondary"
            className="h-14 w-full border border-ink"
            data-testid="buy-now-button"
          >
            Купить сейчас
          </Button>
        </div>
        {selectedVariant && isValidVariant && !inStock && !disabled && (
          <СообщитьОПоступлении
            variantId={selectedVariant.id}
            название={[product.title, selectedVariant.title].filter(Boolean).join(", ")}
            адрес={product.handle ?? undefined}
          />
        )}
        {ошибка && (
          <p className="text-sm text-red-600" role="alert" data-testid="add-to-cart-error">
            {ошибка}
          </p>
        )}
      </div>
    </>
  )
}
