import { defineConfig, devices } from "@playwright/test"

/**
 * Сценарии покупателя: навигация, корзина, оформление до оплаты.
 *
 * Гоняются против живой витрины — по умолчанию той, что на сервере
 * (порт 8000, мимо nginx и пароля). Другой адрес — E2E_BASE.
 *
 * Чего сценарии НЕ делают: не оформляют заказ, не платят, не пробивают
 * чеки. Корзины при этом создаются — как у любого посетителя; Medusa
 * хранит их и сама не чистит.
 *
 * Как запустить — README.md рядом.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // сервер на два ядра: параллельно гонять — мерить его, а не сайт
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE || "http://127.0.0.1:8000",
    locale: "ru-RU",
    trace: "retain-on-failure",
    launchOptions: { args: ["--disable-dev-shm-usage"] },
  },
  projects: [
    {
      name: "kompyuter",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } },
    },
    {
      name: "telefon",
      use: { ...devices["Pixel 7"] },
    },
  ],
})
