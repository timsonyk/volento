"use client"

import { addToCart } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { isEqual } from "lodash"
import { useParams, usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import ProductPrice from "../product-price"
import { useRouter } from "next/navigation"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

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
}: ProductActionsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [isAdding, setIsAdding] = useState(false)
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

    router.replace(pathname + "?" + params.toString())
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

  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null

    setIsAdding(true)

    await addToCart({
      variantId: selectedVariant.id,
      quantity: 1,
      countryCode,
    })

    setIsAdding(false)
  }

  // «Купить сейчас» — та же покупка, только без остановки в корзине:
  // кладём вещь и сразу ведём к оформлению
  const handleBuyNow = async () => {
    if (!selectedVariant?.id) return null

    setIsAdding(true)
    await addToCart({
      variantId: selectedVariant.id,
      quantity: 1,
      countryCode,
    })
    setIsAdding(false)
    router.push(`/${countryCode}/checkout?step=address`)
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
                    />
                  </div>
                )
              })}
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
            {!selectedVariant || !isValidVariant
              ? "Выберите размер и рост"
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
      </div>
    </>
  )
}
