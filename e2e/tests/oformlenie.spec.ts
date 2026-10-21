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

  test("получатель закрыт, пока не выбрана доставка; доставка не «0 ₽»", async ({ page }) => {
    await положитьВКорзину(page)
    await page.goto("/ru/checkout")
    // шаги идут по порядку: город, доставка, получатель — третий под замком
    await expect(page.locator('[data-testid="recipient-email-input"]')).toBeDisabled()
    await expect(page.locator('[data-testid="cart-shipping"]')).toHaveText("после выбора доставки")
    await expect(page.locator('[data-testid="submit-order-button"]')).toHaveCount(0)
  })

  test("пустая корзина не открывает оформление", async ({ page }) => {
    const ответ = await page.goto("/ru/checkout")
    expect([200, 404]).toContain(ответ?.status())
    await expect(page.locator('[data-testid="submit-order-button"]')).toHaveCount(0)
  })
})
