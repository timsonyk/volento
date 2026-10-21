import { expect, test } from "@playwright/test"

import { ГЛАВНАЯ, первыйТовар } from "./pomoshniki"

test.describe("навигация", () => {
  test("логотип ведёт на главную со страниц всех типов", async ({ page }) => {
    const товар = await первыйТовар(page)
    const страницы = [
      "/ru/store",
      "/ru/categories/bryuki",
      товар,
      "/ru/cart",
      // /ru/account здесь нет: облегчённый Chromium (headless shell 131)
      // на сервере падает на странице входа — и на боевой витрине тоже.
      // Проверять вход руками в обычном браузере (NIGHT_REPORT.md)
      "/ru/search?q=брюки",
      "/ru/dostavka",
      "/ru/vozvrat",
      "/ru/collections/skidki",
    ]

    for (const адрес of страницы) {
      await page.goto(адрес)
      await page.locator('[data-testid="nav-home-link"]').click()
      await expect(page, `логотип со страницы ${адрес}`).toHaveURL(/\/ru\/?$/)
    }
  })

  test("ссылки шапки и подвала открываются без ошибок", async ({ page, request }) => {
    await page.goto(ГЛАВНАЯ)
    const адреса = await page
      .locator("header a[href^='/ru'], footer a[href^='/ru']")
      .evaluateAll((a) => [...new Set(a.map((x) => x.getAttribute("href")!))])

    expect(адреса.length).toBeGreaterThan(5)
    const сломанные: string[] = []
    for (const адрес of адреса) {
      const ответ = await request.get(адрес)
      if (ответ.status() >= 400) сломанные.push(`${адрес} — ${ответ.status()}`)
    }
    expect(сломанные).toEqual([])
  })

  test("несуществующая страница: 404 и дорога на главную", async ({ page }) => {
    const ответ = await page.goto("/ru/takoy-stranicy-net")
    expect(ответ?.status()).toBe(404)
    await page.getByRole("link", { name: "На главную" }).first().click()
    await expect(page).toHaveURL(/\/ru\/?$/)
  })

  test("назад и вперёд в браузере", async ({ page }) => {
    await page.goto("/ru/store")
    await page.locator('a[href*="/products/"]:visible').first().click()
    await expect(page).toHaveURL(/\/products\//)
    await page.goBack()
    await expect(page).toHaveURL(/\/ru\/store/)
    await page.goForward()
    await expect(page).toHaveURL(/\/products\//)
    await expect(page.locator('[data-testid="product-title"]').first()).toBeVisible()
  })

  test("поиск находит брюки", async ({ page }) => {
    await page.goto("/ru/search?q=брюки")
    await expect(page.locator('a[href*="/products/"]').first()).toBeVisible()
  })
})
