import type { MedusaContainer } from "@medusajs/framework/types"

import { проверитьПоступления } from "../lib/postuplenie"

/**
 * Раз в четверть часа смотрим, не появились ли размеры, о которых
 * покупатели просили сообщить, и пишем им (lib/postuplenie.ts).
 */
export default async function сторожПоступлений(container: MedusaContainer) {
  await проверитьПоступления(container)
}

export const config = {
  name: "postuplenie",
  schedule: "7,22,37,52 * * * *",
}
