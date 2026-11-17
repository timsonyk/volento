/**
 * «Вы смотрели» (образец). Последние открытые вещи живут в браузере
 * покупателя, как и «Избранное»: входить не нужно, на сервер ничего не
 * уходит.
 *
 * Пока это образец, блок виден только тому, кто открыл любую страницу
 * с ?obrazec=smotreli (отметка ложится в тот же браузер). Остальные
 * покупатели его не видят, и их просмотры не записываются.
 */
export type Просмотренная = { handle: string; title: string; thumbnail?: string | null }

const КЛЮЧ = "volento_smotreli"
const КЛЮЧ_ОБРАЗЦА = "volento_obrazec_smotreli"
const МАКСИМУМ = 9

export const образецВключён = (): boolean => {
  try {
    const изАдреса = new URLSearchParams(window.location.search).get("obrazec")
    if (изАдреса === "smotreli") localStorage.setItem(КЛЮЧ_ОБРАЗЦА, "1")
    if (изАдреса === "net") localStorage.removeItem(КЛЮЧ_ОБРАЗЦА)
    return localStorage.getItem(КЛЮЧ_ОБРАЗЦА) === "1"
  } catch {
    return false
  }
}

export const прочитатьПросмотры = (): Просмотренная[] => {
  try {
    const список = JSON.parse(localStorage.getItem(КЛЮЧ) || "[]")
    return Array.isArray(список) ? список.filter((в) => в?.handle) : []
  } catch {
    return []
  }
}

/** Ставит вещь первой в списке и возвращает остальные, без неё самой. */
export const записатьПросмотр = (вещь: Просмотренная): Просмотренная[] => {
  const прежние = прочитатьПросмотры().filter((в) => в.handle !== вещь.handle)
  try {
    localStorage.setItem(КЛЮЧ, JSON.stringify([вещь, ...прежние].slice(0, МАКСИМУМ)))
  } catch {
    // браузер без хранилища: блок просто не появится
  }
  return прежние.slice(0, МАКСИМУМ - 1)
}
