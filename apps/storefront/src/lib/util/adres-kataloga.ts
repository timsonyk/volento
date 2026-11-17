import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

/**
 * Сортировка и номер страницы приходят из адреса, а адрес может быть
 * любым: старая ссылка, опечатка, робот.
 *
 * Неизвестная сортировка раньше уходила в запасной путь, который тянет
 * сотню товаров целиком: страница открывалась 6–9 секунд и не попадала
 * в кэш. Кривой номер страницы (буквы, минус) давал пустую сетку.
 */
const СОРТИРОВКИ: SortOptions[] = ["created_at", "price_asc", "price_desc"]

export const сортировкаИзАдреса = (v?: string): SortOptions =>
  СОРТИРОВКИ.includes(v as SortOptions) ? (v as SortOptions) : "created_at"

export const страницаИзАдреса = (v?: string): number => {
  const n = parseInt(v ?? "", 10)
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 100000) : 1
}
