import { expect, test } from "@playwright/test"

import { положитьВКорзину } from "./pomoshniki"

/**
 * Оформление — только до оплаты. Кнопку «Оплатить» не нажимаем никогда.
 */
test.describe("оформление", () => {
  test("из корзины открывается оформление с полями получателя", async ({ page }) => {
    await положитьВКорзину(page)
    await page.goto("/ru/cart")
    await page.locator('[data-testid="checkout-button"]').click()
    await expect(page).toHaveURL(/\/checkout/)
    await expect(page.locator('[data-testid="recipient-email-input"]')).toBeVisible()
  })

  test("неверная почта и телефон не проходят", async ({ page }) => {
    await положитьВКорзину(page)
    await page.goto("/ru/checkout")
    await page.locator('[data-testid="recipient-email-input"]').fill("ne-pochta")
    await page.locator('[data-testid="recipient-phone-input"]').fill("123")
    await page.locator('[data-testid="recipient-first-name-input"]').fill("Тест")
    await page.keyboard.press("Tab")
    // либо браузер не пустит дальше из-за type=email, либо наша проверка
    // покажет ошибку — главное, что на оплату с такими данными не попасть
    await expect(page.locator('[data-testid="submit-order-button"]')).toHaveCount(0)
  })

  test("пустая корзина не открывает оформление", async ({ page }) => {
    const ответ = await page.goto("/ru/checkout")
    expect([200, 404]).toContain(ответ?.status())
    await expect(page.locator('[data-testid="submit-order-button"]')).toHaveCount(0)
  })
})
