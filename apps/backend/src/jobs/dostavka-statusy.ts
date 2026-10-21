import type { MedusaContainer } from "@medusajs/framework/types"

import { проверитьДоставку } from "../lib/dostavka-statusy"

/**
 * Сторож доставки: раз в четверть часа спрашивает ApiShip, что с
 * упакованными посылками, и подводит итог выдачи — чек на забранное,
 * деньги за незабранное (lib/dostavka-itog.ts).
 */
export default async function сторожДоставки(container: MedusaContainer) {
  await проверитьДоставку(container)
}

export const config = {
  name: "dostavka-statusy",
  schedule: "*/15 * * * *",
}
