import { revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

import { ВИТРИНА } from "@lib/data/cookies"

/**
 * Забыть всё, что витрина запомнила: товары, цены, остатки, главную.
 *
 * Зовёт бэкенд, когда в админке что-то поменяли (apps/backend/src/lib/
 * pamyat-vitriny.ts). Ключ общий с бэкендом — OBNOVIT_KEY.
 */
export async function POST(req: NextRequest) {
  const ключ = process.env.OBNOVIT_KEY

  if (!ключ || req.headers.get("x-klyuch") !== ключ) {
    return NextResponse.json({ ошибка: "Нет доступа" }, { status: 403 })
  }

  revalidateTag(ВИТРИНА)
  return NextResponse.json({ ok: true })
}
