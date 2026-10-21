"use client"

import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import Accordion from "./accordion"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

/**
 * Раскрывашка под кнопкой «В корзину».
 *
 * Вкладку «Характеристики» из стартового шаблона убрали: она брала
 * материал, вес и габариты из стандартных полей Medusa, а они у всех
 * товаров пустые — покупатель видел колонку прочерков. Состав, ткань,
 * страна и уход показаны выше, в сведениях о товаре.
 *
 * «Доставка и возврат» пересказывает страницы «Доставка» и «Возврат»
 * своими словами не больше, чем там написано: раньше здесь стояли
 * шаблонные «3–5 дней, прямо к вам домой» и «обменяем без лишних
 * вопросов», а курьера у нас пока нет.
 */
const ProductTabs = (_props: ProductTabsProps) => {
  return (
    <div className="w-full">
      <Accordion type="multiple">
        <Accordion.Item
          title="Доставка и возврат"
          headingSize="medium"
          value="dostavka"
        >
          <ShippingInfoTab />
        </Accordion.Item>
      </Accordion>
    </div>
  )
}

const ShippingInfoTab = () => {
  return (
    <div className="flex flex-col gap-y-6 py-8 text-sm text-ink">
      <div>
        <p className="font-semibold">Доставка</p>
        <p className="mt-1 max-w-sm">
          В пункты выдачи СДЭК и Яндекс Доставки по всей России. Стоимость и
          срок видны при оформлении заказа, до оплаты.
        </p>
        <LocalizedClientLink
          href="/dostavka"
          className="mt-2 inline-block underline underline-offset-4"
        >
          Подробнее о доставке
        </LocalizedClientLink>
      </div>
      <div>
        <p className="font-semibold">Возврат</p>
        <p className="mt-1 max-w-sm">
          В течение семи дней после получения, если вещь не носили и
          сохранены ярлыки.
        </p>
        <LocalizedClientLink
          href="/vozvrat"
          className="mt-2 inline-block underline underline-offset-4"
        >
          Как вернуть
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default ProductTabs
