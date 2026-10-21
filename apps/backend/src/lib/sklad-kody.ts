/**
 * Где в заказе лежат коды «Честного знака»: metadata.kody_markirovki,
 * { [id строки]: [код, код, …] }. Отдельным файлом без процессов Medusa:
 * его подключает и провайдер доставки (modules/dostavka-apiship), а тот
 * грузится раньше всего остального.
 */
export const КОДЫ = "kody_markirovki"
