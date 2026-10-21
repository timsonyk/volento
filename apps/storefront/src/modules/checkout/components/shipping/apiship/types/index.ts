/**
 * Описания того, что приходит от ApiShip.
 *
 * Плагин отдаёт свои типы пакетом, но пакет этот — серверный, со всеми
 * зависимостями Medusa. Тянуть его в витрину ради нескольких описаний
 * дорого, поэтому нужные поля описаны здесь. Незнакомые поля не теряются:
 * они разрешены явно, чтобы обновление ApiShip ничего не сломало.
 */
type Прочее = Record<string, unknown>

/** Тариф службы доставки: сколько стоит и за сколько дней. */
export type ApishipTariffBase = {
  tariffId?: number | string
  tariffProviderId?: number | string
  tariffName?: string
  daysMin?: number
  daysMax?: number
  /** цена со скидкой, копейки или рубли — как отдаёт служба */
  deliveryCost?: number
  /** цена без скидки; показываем зачёркнутой, если отличается */
  deliveryCostOriginal?: number
} & Прочее

export type ApishipCalculation = {
  deliveryToDoor?: Array<{
    providerKey: string
    tariffs?: Array<ApishipTariffBase>
  }>
  deliveryToPoint?: Array<{
    providerKey: string
    tariffs?: Array<ApishipTariffBase>
  }>
}

/** Тариф с добавленным ключом — по нему отличаем выбранный вариант. */
export type ApishipTariff = {
  key: string
  providerKey: string
} & ApishipTariffBase

/** Пункт выдачи: точка на карте с адресом и часами работы. */
export type ApishipPoint = {
  id: string
  lat: number
  lng: number
  name?: string
  address?: string
  description?: string
  timetable?: string
  worktime?: Record<string, string>
  /** 1 — есть примерочная: можно примерить и забрать только то, что подошло */
  fittingRoom?: number
} & Прочее

/** Выбор покупателя: способ, тариф и, для доставки в ПВЗ, пункт. */
export type Chosen = {
  deliveryType: number
  tariff: ApishipTariff
  point?: ApishipPoint
}
