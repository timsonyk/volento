import { expect, test } from "@playwright/test"

import { положитьВКорзину } from "./pomoshniki"

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

  test("после нажатия кнопка «В корзину» снова чёрная, а не серая", async ({ page }) => {
    // наведение на сенсорном экране залипало: кнопка оставалась серой,
    // будто выключена
    await положитьВКорзину(page)
    const кнопка = page.locator('[data-testid="add-product-button"]')
    await expect(кнопка).toBeEnabled()
    await expect(кнопка).toHaveCSS("background-color", "rgb(11, 11, 11)")
  })

  test("самый узкий телефон (320): значки шапки не липнут к логотипу", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto("/ru")
    const рамка = async (отбор: string) => (await page.locator(отбор).boundingBox())!
    const лого = await рамка('[data-testid="nav-home-link"]')
    const поиск = await рамка('[data-testid="nav-search-link-mobile"]')
    const кабинет = await рамка('[data-testid="nav-account-link"]')
    expect(лого.x - (поиск.x + поиск.width)).toBeGreaterThanOrEqual(8)
    expect(кабинет.x - (лого.x + лого.width)).toBeGreaterThanOrEqual(8)
  })

  test("самый узкий телефон (320): плашка про cookie занимает не больше трети экрана", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto("/ru")
    const плашка = page.locator('[data-testid="cookie-notice"]')
    await expect(плашка).toBeVisible()
    const рамка = (await плашка.boundingBox())!
    expect(рамка.height).toBeLessThanOrEqual(568 / 3)
    // обе кнопки целиком на экране и в них удобно попасть пальцем
    for (const имя of ["cookie-necessary", "cookie-accept"]) {
      const кнопка = (await page.locator(`[data-testid="${имя}"]`).boundingBox())!
      expect(кнопка.x, имя).toBeGreaterThanOrEqual(0)
      expect(кнопка.x + кнопка.width, имя).toBeLessThanOrEqual(320)
      expect(кнопка.height, имя).toBeGreaterThanOrEqual(40)
    }
    await page.locator('[data-testid="cookie-accept"]').click()
    await expect(плашка).toBeHidden()
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

test.describe("поля на телефоне", () => {
  test("текст в полях не мельче 16 px, иначе айфон приближает страницу", async ({ page, isMobile }) => {
    test.skip(!isMobile, "только телефон")
    await page.goto("/ru/account")
    const поле = page.locator('[data-testid="vhod-pochta"]')
    await expect(поле).toBeVisible()
    const размер = await поле.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
    expect(размер).toBeGreaterThanOrEqual(16)
  })
})
