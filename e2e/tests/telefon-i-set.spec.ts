import { expect, test } from "@playwright/test"

test.describe("телефон", () => {
  test.skip(({ isMobile }) => !isMobile, "только телефон")

  test("шторка меню открывается и ведёт в раздел", async ({ page }) => {
    await page.goto("/ru")
    await page.locator('[data-testid="nav-menu-button"]').click()
    const шторка = page.locator('[data-testid="nav-menu-popup"]')
    await expect(шторка).toBeVisible()
    await шторка.locator('a[href*="/categories/"]').first().click()
    await expect(page).toHaveURL(/\/categories\//)
  })

  test("страница не шире экрана", async ({ page }) => {
    for (const адрес of ["/ru", "/ru/store", "/ru/cart", "/ru/dostavka"]) {
      await page.goto(адрес)
      const лишнее = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      )
      expect(лишнее, адрес).toBeLessThanOrEqual(1)
    }
  })
})

test.describe("медленная сеть", () => {
  test("после нажатия на логотип сразу видно, что идёт загрузка", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "сеть замедляем через CDP")
    await page.goto("/ru/dostavka")
    const cdp = await context.newCDPSession(page)
    await cdp.send("Network.enable")
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 400,
      downloadThroughput: (400 * 1024) / 8,
      uploadThroughput: (400 * 1024) / 8,
    })
    await page.locator('[data-testid="nav-home-link"]').click()
    // полоса загрузки (app/[countryCode]/(main)/loading.tsx) или уже главная
    await expect(
      page.locator('[aria-busy="true"]').or(page.locator("#podborka, section")).first()
    ).toBeVisible({ timeout: 2_000 })
    await expect(page).toHaveURL(/\/ru\/?$/, { timeout: 30_000 })
  })
})
