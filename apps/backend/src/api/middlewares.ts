import { authenticate, defineMiddlewares } from "@medusajs/framework/http"

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
  ],
})
