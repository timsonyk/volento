/**
 * Правки из админки — сразу на витрину.
 *
 * Витрина (Next.js) запоминает товары, цены, остатки и картинки главной,
 * чтобы страницы открывались быстро. Пара ответов запоминается и здесь,
 * в бэкенде (/store/v-nalichii, /store/ceny-sortirovka). Когда в админке
 * что-то поменяли, обе памяти надо сбросить, иначе покупатель увидит
 * старое.
 *
 * Порядок: подписчик (subscribers/obnovit-vitrinu.ts) или ручка склада
 * зовут обновитьВитрину(). Через несколько секунд затишья уходит один
 * запрос в сам сервер, POST /vitrina/obnovit: тот забывает свою память
 * и просит витрину сбросить её (POST /api/obnovit на витрине).
 *
 * Пауза нужна, потому что одна правка в админке рождает десятки событий
 * (товар, каждый размер, цены), а склад шлёт остатки пачками.
 */

const сбросы = new Set<() => void>()

/** Ручка, которая что-то запоминает, регистрирует здесь, как это забыть. */
export const привязатьПамять = (сброс: () => void) => {
  сбросы.add(сброс)
}

export const забытьВсё = () => {
  for (const сброс of сбросы) {
    сброс()
  }
}

const ПАУЗА_МС = 3_000

let таймер: ReturnType<typeof setTimeout> | null = null

export const ключОбновления = () => process.env.OBNOVIT_KEY

export function обновитьВитрину(logger?: { warn: (с: string) => void }) {
  if (!ключОбновления()) {
    return
  }

  if (таймер) {
    clearTimeout(таймер)
  }

  таймер = setTimeout(async () => {
    таймер = null
    const сервер = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:9000"

    try {
      const ответ = await fetch(`${сервер}/vitrina/obnovit`, {
        method: "POST",
        headers: { "x-klyuch": ключОбновления()! },
      })
      if (!ответ.ok) {
        throw new Error(`ответ ${ответ.status}`)
      }
    } catch (ошибка: any) {
      logger?.warn(`Витрина не обновлена: ${ошибка?.message}`)
    }
  }, ПАУЗА_МС)
}
