"use client"

import { Table, Text, clx } from "@modules/common/components/ui"
import { updateLineItem } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import CartItemSelect from "@modules/cart/components/cart-item-select"
import ErrorMessage from "@modules/checkout/components/error-message"
import DeleteButton from "@modules/common/components/delete-button"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Spinner from "@modules/common/icons/spinner"
import Thumbnail from "@modules/products/components/thumbnail"
import { поЧеловечески } from "@lib/util/sklad"
import { useState } from "react"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem
  type?: "full" | "preview"
  currencyCode: string
}

/**
 * Сколько этого размера можно заказать.
 *
 * Раньше список всегда предлагал до десяти штук, сколько бы ни лежало на
 * складе: человек выбирал пять, склад отказывал, и в строке появлялась
 * английская ошибка от Medusa. Теперь в списке ровно то, что есть.
 */
const ПОТОЛОК = 10

/** Остаток на складе или null, если размер не считаем поштучно. */
const остатокСклада = (item: HttpTypes.StoreCartLineItem) => {
  const v = item.variant
  if (!v || v.manage_inventory === false || v.allow_backorder) {
    return null
  }
  return v.inventory_quantity ?? 0
}

const сколькоМожно = (item: HttpTypes.StoreCartLineItem) => {
  const остаток = остатокСклада(item)
  if (остаток === null) {
    return ПОТОЛОК
  }
  // Уже лежащее в корзине показываем, даже если остаток успел упасть, —
  // иначе выбранное число пропало бы из списка и выглядело бы поломкой.
  return Math.min(ПОТОЛОК, Math.max(остаток, item.quantity))
}

const Item = ({ item, type = "full", currencyCode }: ItemProps) => {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const можно = сколькоМожно(item)
  const остаток = остатокСклада(item)
  // Остаток мог упасть уже после того, как товар положили в корзину:
  // предупреждаем сразу, а не на кнопке «Оформить заказ».
  const нехватает =
    остаток !== null && остаток < item.quantity
      ? остаток > 0
        ? `В наличии только ${остаток} — уменьшите количество.`
        : "Этого размера больше нет в наличии."
      : null

  const changeQuantity = async (quantity: number) => {
    setError(null)
    setUpdating(true)

    await updateLineItem({
      lineId: item.id,
      quantity,
    })
      .catch((err: Error) => {
        setError(поЧеловечески(err.message, остатокСклада(item)))
      })
      .finally(() => {
        setUpdating(false)
      })
  }

  return (
    <Table.Row className="w-full" data-testid="product-row">
      <Table.Cell className="!pl-0 p-4 w-24">
        <LocalizedClientLink
          href={`/products/${item.product_handle}`}
          className={clx("flex", {
            "w-16": type === "preview",
            "small:w-24 w-12": type === "full",
          })}
        >
          <Thumbnail
            thumbnail={item.thumbnail}
            images={item.variant?.product?.images}
            size="square"
          />
        </LocalizedClientLink>
      </Table.Cell>

      <Table.Cell className="text-left">
        <Text
          className="txt-medium-plus text-ui-fg-base"
          data-testid="product-title"
        >
          {item.product_title}
        </Text>
        <LineItemOptions variant={item.variant} data-testid="product-variant" />
      </Table.Cell>

      {type === "full" && (
        <Table.Cell>
          <div className="flex gap-2 items-center w-28">
            <DeleteButton id={item.id} data-testid="product-delete-button" />
            <CartItemSelect
              value={item.quantity}
              onChange={(value) => changeQuantity(parseInt(value.target.value))}
              className="w-14 h-10 p-4"
              data-testid="product-select-button"
            >
              {Array.from({ length: можно }, (_, i) => (
                <option value={i + 1} key={i + 1}>
                  {i + 1}
                </option>
              ))}
            </CartItemSelect>
            {updating && <Spinner />}
          </div>
          <ErrorMessage
            error={error ?? нехватает}
            data-testid="product-error-message"
          />
        </Table.Cell>
      )}

      {type === "full" && (
        <Table.Cell className="hidden small:table-cell">
          <LineItemUnitPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </Table.Cell>
      )}

      <Table.Cell className="!pr-0">
        <span
          className={clx("!pr-0", {
            "flex flex-col items-end h-full justify-center": type === "preview",
          })}
        >
          {type === "preview" && (
            <span className="flex gap-x-1 ">
              <Text className="text-ui-fg-muted">{item.quantity}x </Text>
              <LineItemUnitPrice
                item={item}
                style="tight"
                currencyCode={currencyCode}
              />
            </span>
          )}
          <LineItemPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </span>
      </Table.Cell>
    </Table.Row>
  )
}

export default Item
