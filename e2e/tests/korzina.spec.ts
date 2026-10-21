import { expect, test } from "@playwright/test"

import { выбратьРазмерВНаличии, первыйТовар, положитьВКорзину } from "./pomoshniki"

test.describe("корзина", () => {
  test("до выбора размера кнопка просит выбрать, а не пишет «нет в наличии»", async ({ page }) => {
    await page.goto(await первыйТовар(page))
    const кнопка = page.locator('[data-testid="add-product-button"]')
    await expect(кнопка).toBeDisabled()
    await expect(кнопка).toContainText("Выберите")
  })

  test("размер, корзина, количество, удаление, пустая корзина", async ({ page }) => {
    await положитьВКорзину(page)

    await page.goto("/ru/cart")
    const строка = page.locator('[data-testid="product-row"]:visible').first()
    await expect(строка).toBeVisible()
    const итогДо = await page.locator('[data-testid="cart-subtotal"]').innerText()

    const количество = строка.locator('[data-testid="product-select-button"]')
    if (await количество.count()) {
      await количество.selectOption("2")
      await expect(page.locator('[data-testid="cart-subtotal"]')).not.toHaveText(итогДо)
    }

    await строка.locator('[data-testid="product-delete-button"]').click()
    await expect(page.locator('[data-testid="empty-cart-message"]')).toBeVisible()
  })

  test("перечёркнутый размер не даёт купить", async ({ page }) => {
    await page.goto("/ru/store")
    const адреса = await page
      .locator('a[href*="/products/"]:visible')
      .evaluateAll((a) => [...new Set(a.map((x) => x.getAttribute("href")!))].slice(0, 8))

    for (const адрес of адреса) {
      await page.goto(адрес)
      const нет = page.locator('[data-testid="option-button"].line-through').first()
      if (!(await нет.count())) continue
      await нет.click()
      await expect(page.locator('[data-testid="add-product-button"]')).toBeDisabled()
      return
    }
    test.skip(true, "в первых товарах нет перечёркнутых размеров")
  })

  test("у товара в наличии размер находится", async ({ page }) => {
    await page.goto(await первыйТовар(page))
    expect(await выбратьРазмерВНаличии(page)).toBe(true)
  })
})
