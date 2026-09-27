import { authenticate, defineMiddlewares } from "@medusajs/framework/http"

import { пускатьТолькоГотовые } from "../lib/pravilo-publikacii"

/**
 * Ручка связывания требует входа, но покупателя у обратившегося ещё
 * нет — только что выданный ключ выписан на личность. Поэтому
 * allowUnregistered: ровно так же защищена штатная ручка создания
 * покупателя в Medusa.
 */
export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/vhod/svyazat",
      method: "POST",
      middlewares: [
        authenticate("customer", ["bearer"], { allowUnregistered: true }),
      ],
    },
    {
      // Товар без фотографии или без цены опубликовать нельзя —
      // проверяем в тот момент, когда его переводят в «опубликован».
      matcher: "/admin/products",
      method: "POST",
      middlewares: [пускатьТолькоГотовые],
    },
    {
      matcher: "/admin/products/:id",
      method: "POST",
      middlewares: [пускатьТолькоГотовые],
    },
    {
      matcher: "/admin/products/batch",
      method: "POST",
      middlewares: [пускатьТолькоГотовые],
    },
    {
      matcher: "/store/vhod/telefon",
      method: "POST",
      middlewares: [
        authenticate("customer", ["bearer"], { allowUnregistered: true }),
      ],
    },
  ],
})
