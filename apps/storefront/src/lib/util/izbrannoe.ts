/**
 * «Избранное» (образец). Список живёт в браузере покупателя: входить не
 * нужно, на сервер ничего не уходит. Храним только то, что нужно для
 * карточки: адрес, название и снимок.
 */
export type Избранная = { handle: string; title: string; thumbnail?: string | null }

const КЛЮЧ = "volento_izbrannoe"
export const СОБЫТИЕ = "volento:izbrannoe"
const МАКСИМУМ = 60

export const прочитатьИзбранное = (): Избранная[] => {
  try {
    const список = JSON.parse(localStorage.getItem(КЛЮЧ) || "[]")
    return Array.isArray(список) ? список.filter((в) => в?.handle) : []
  } catch {
    return []
  }
}

/** Добавляет вещь или убирает, если она уже в списке. Возвращает, в списке ли она теперь. */
export const переключитьИзбранное = (вещь: Избранная): boolean => {
  const список = прочитатьИзбранное()
  const была = список.some((в) => в.handle === вещь.handle)
  const стало = была
    ? список.filter((в) => в.handle !== вещь.handle)
    : [вещь, ...список].slice(0, МАКСИМУМ)
  try {
    localStorage.setItem(КЛЮЧ, JSON.stringify(стало))
    window.dispatchEvent(new Event(СОБЫТИЕ))
  } catch {
    // браузер без хранилища — список просто не сохранится
  }
  return !была
}
