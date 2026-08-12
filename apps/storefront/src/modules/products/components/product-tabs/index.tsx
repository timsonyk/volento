"use client"

import Back from "@modules/common/icons/back"
import FastDelivery from "@modules/common/icons/fast-delivery"
import Refresh from "@modules/common/icons/refresh"

import Accordion from "./accordion"
import { HttpTypes } from "@medusajs/types"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const ProductTabs = ({ product }: ProductTabsProps) => {
  const tabs = [
    {
      label: "Характеристики",
      component: <ProductInfoTab product={product} />,
    },
    {
      label: "Доставка и возврат",
      component: <ShippingInfoTab />,
    },
  ]

  return (
    <div className="w-full">
      <Accordion type="multiple">
        {tabs.map((tab, i) => (
          <Accordion.Item
            key={i}
            title={tab.label}
            headingSize="medium"
            value={tab.label}
          >
            {tab.component}
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  )
}

const ProductInfoTab = ({ product }: ProductTabsProps) => {
  return (
    <div className="text-small-regular py-8">
      <div className="grid grid-cols-2 gap-x-8">
        <div className="flex flex-col gap-y-4">
          <div>
            <span className="font-semibold">Материал</span>
            <p>{product.material ? product.material : "-"}</p>
          </div>
          <div>
            <span className="font-semibold">Страна производства</span>
            <p>{product.origin_country ? product.origin_country : "-"}</p>
          </div>
          <div>
            <span className="font-semibold">Тип</span>
            <p>{product.type ? product.type.value : "-"}</p>
          </div>
        </div>
        <div className="flex flex-col gap-y-4">
          <div>
            <span className="font-semibold">Вес</span>
            <p>{product.weight ? `${product.weight} г` : "-"}</p>
          </div>
          <div>
            <span className="font-semibold">Размеры</span>
            <p>
              {product.length && product.width && product.height
                ? `${product.length}Д x ${product.width}Ш x ${product.height}В`
                : "-"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const ShippingInfoTab = () => {
  return (
    <div className="text-small-regular py-8">
      <div className="grid grid-cols-1 gap-y-8">
        <div className="flex items-start gap-x-2">
          <FastDelivery />
          <div>
            <span className="font-semibold">Быстрая доставка</span>
            <p className="max-w-sm">
              Заказ приедет за 3-5 рабочих дней в пункт выдачи или прямо к вам
              домой.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <Refresh />
          <div>
            <span className="font-semibold">Простой обмен</span>
            <p className="max-w-sm">
              Не подошёл размер? Не беспокойтесь: мы обменяем товар на
              подходящий.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <Back />
          <div>
            <span className="font-semibold">Лёгкий возврат</span>
            <p className="max-w-sm">
              Просто верните товар, и мы вернём деньги. Без лишних вопросов: мы
              сделаем всё, чтобы возврат прошёл без хлопот.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductTabs
