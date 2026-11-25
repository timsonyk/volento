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
      "/ru/account",
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

  test("несуществующий файл: 404, а не главная страница", async ({ request }) => {
    for (const адрес of ["/apple-touch-icon.png", "/takogo-fayla-net.png", "/manifest.webmanifest"]) {
      const ответ = await request.get(адрес)
      expect(ответ.status(), адрес).toBe(404)
    }
    // настоящие файлы сайта при этом отдаются
    for (const адрес of ["/icon.png", "/volento-logo.png", "/favicon.ico", "/robots.txt"]) {
      const ответ = await request.get(адрес)
      expect(ответ.status(), адрес).toBe(200)
    }
  })

  test("карточка ссылки на товар: фото вещи, а не общая картинка сайта", async ({ page }) => {
    await page.goto("/ru/store")
    await page.locator('a[href*="/products/"]:visible').first().click()
    await expect(page).toHaveURL(/\/products\//)
    const og = await page.locator('meta[property="og:image"]').first().getAttribute("content")
    const tw = await page.locator('meta[name="twitter:image"]').first().getAttribute("content")
    expect(og).toBeTruthy()
    expect(og).not.toContain("opengraph-image")
    expect(tw).toBe(og)
    const адрес = await page.locator('meta[property="og:url"]').first().getAttribute("content")
    expect(адрес).toContain("/products/")
  })

  test("скрытый товар закрыт от поисковиков, обычный открыт", async ({ page }) => {
    const ответ = await page.goto("/ru/products/proverka-oplaty")
    test.skip(ответ?.status() !== 200, "скрытого товара в каталоге нет")
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
    await page.goto("/ru/store")
    await page.locator('a[href*="/products/"]:visible').first().click()
    await expect(page).toHaveURL(/\/products\//)
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0)
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

test.describe("разметка товара для поисковиков", () => {
  test.skip(({ isMobile }) => isMobile, "разметка одна на оба экрана")

  test("цена в разметке настоящая: одна или вилка от и до", async ({ page }) => {
    await page.goto("/ru/store")
    const ссылки = await page
      .locator('a[href*="/products/"]:visible')
      .evaluateAll((a) => [...new Set(a.map((x) => x.getAttribute("href")!))].slice(0, 4))

    for (const адрес of ссылки) {
      await page.goto(адрес)
      const сырое = await page.locator('script[type="application/ld+json"]').first().textContent()
      const р = JSON.parse(сырое!)
      expect(р["@type"]).toBe("Product")
      expect(String(р.name).length).toBeGreaterThan(3)
      expect(р.offers.priceCurrency).toBe("RUB")
      if (р.offers["@type"] === "AggregateOffer") {
        expect(р.offers.lowPrice).toBeGreaterThan(0)
        expect(р.offers.highPrice).toBeGreaterThan(р.offers.lowPrice)
        expect(р.offers.offerCount).toBeGreaterThan(1)
      } else {
        expect(р.offers["@type"]).toBe("Offer")
        expect(р.offers.price).toBeGreaterThan(0)
      }
    }
  })
})
