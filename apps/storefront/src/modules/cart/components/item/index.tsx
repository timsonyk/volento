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
import { useRouter } from "next/navigation"
import { useState } from "react"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem
  type?: "full" | "preview"
  currencyCode: string
  /** Сколько этого размера осталось. undefined — учёт не поштучный. */
  остаток?: number
}

/**
 * Сколько этого размера можно заказать.
 *
 * Раньше список всегда предлагал до десяти штук, сколько бы ни лежало на
 * складе: человек выбирал пять, склад отказывал, и в строке появлялась
 * английская ошибка от Medusa. Теперь в списке ровно то, что есть.
 *
 * Остаток приходит снаружи: в ответе корзины его нет, его добывает
 * отдельный запрос (lib/data/ostatki.ts).
 */
const ПОТОЛОК = 10

const Item = ({ item, type = "full", currencyCode, остаток }: ItemProps) => {
  const [updating, setUpdating] = useState(false)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  // Уже лежащее в корзине оставляем в списке, даже если остаток успел
  // упасть, — иначе выбранное число пропало бы и выглядело поломкой.
  const можно =
    остаток === undefined
      ? ПОТОЛОК
      : Math.min(ПОТОЛОК, Math.max(остаток, item.quantity))
  // Остаток мог упасть уже после того, как товар положили в корзину:
  // предупреждаем сразу, а не на кнопке «Оформить заказ».
  const нехватает =
    остаток !== undefined && остаток < item.quantity
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
      // ответ на изменение иногда приносит корзину со старой суммой —
      // перерисовываем страницу заново (как после «В корзину»)
      .then(() => router.refresh())
      .catch((err: Error) => {
        setError(поЧеловечески(err.message, остаток))
      })
      .finally(() => {
        setUpdating(false)
      })
  }

  return (
    // На телефоне строка — не таблица, а карточка: снимок слева, справа
    // название, цена и под ними количество, «удалить» в углу. В таблице
    // название сжималось в узкий столбик, а цена уезжала вправо.
    <Table.Row
      className={clx("w-full", {
        "grid grid-cols-[4rem_1fr_auto] gap-x-4 py-4 small:table-row small:py-0":
          type === "full",
      })}
      data-testid="product-row"
    >
      <Table.Cell
        className={clx("!pl-0 p-4 w-16 small:w-24", {
          "row-span-2 !p-0 small:!p-4 small:!pl-0": type === "full",
        })}
      >
        <LocalizedClientLink
          href={`/products/${item.product_handle}`}
          className={clx("flex", {
            "w-16": type === "preview",
            "small:w-24 w-12": type === "full",
          })}
        >
          {/* Пропорции карточки товара, а не квадрат: квадратная
              обрезка срезала модель и снимок выглядел обрубленным. */}
          <Thumbnail
            thumbnail={item.thumbnail}
            images={item.variant?.product?.images}
            className="rounded-lg"
          />
        </LocalizedClientLink>
      </Table.Cell>

      <Table.Cell
        className={clx("text-left", {
          "col-start-2 !p-0 small:!p-4": type === "full",
        })}
      >
        <Text
          className="txt-medium-plus text-ui-fg-base"
          data-testid="product-title"
        >
          {item.product_title}
        </Text>
        <LineItemOptions variant={item.variant} data-testid="product-variant" />
        {type === "full" && (
          <div className="mt-1 small:hidden [&>div]:items-start">
            <LineItemPrice item={item} style="tight" currencyCode={currencyCode} />
          </div>
        )}
      </Table.Cell>

      {type === "full" && (
        <Table.Cell className="col-start-2 row-start-2 !p-0 !pt-3 small:!p-4">
          <div className="flex gap-2 items-center w-28">
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

      <Table.Cell
        className={clx({
          "!pr-0": type === "preview",
          "hidden small:table-cell": type === "full",
        })}
      >
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

      {/* Удалить — с самого края строки, чтобы не задеть рядом с количеством */}
      {type === "full" && (
        <Table.Cell className="col-start-3 row-start-1 self-start !p-0 small:!p-4 small:!pr-0 w-8">
          <DeleteButton
            id={item.id}
            className="justify-end"
            data-testid="product-delete-button"
          />
        </Table.Cell>
      )}
    </Table.Row>
  )
}

export default Item
