import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { обновитьВитрину } from "../lib/pamyat-vitriny"

/**
 * Что-то поменяли в каталоге — витрина должна показать это сразу.
 * Как именно — lib/pamyat-vitriny.ts.
 *
 * Картинки и надписи главной лежат в служебном товаре home-banner,
 * поэтому их правка — тоже «product.updated».
 */
export default async function обновитьВитринуПоСобытию({ container }: SubscriberArgs<unknown>) {
  обновитьВитрину(container.resolve("logger"))
}

export const config: SubscriberConfig = {
  event: [
    "product.created",
    "product.updated",
    "product.deleted",
    "product-variant.created",
    "product-variant.updated",
    "product-variant.deleted",
    "product-category.created",
    "product-category.updated",
    "product-category.deleted",
    "product-collection.created",
    "product-collection.updated",
    "product-collection.deleted",
    "inventory-level.created",
    "inventory-level.updated",
    "inventory-level.deleted",
    "region.updated",
  ],
}
