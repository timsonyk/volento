import { expect, test } from "@playwright/test"

import { войтиПокупателем, входДоступен, положитьВКорзину } from "./pomoshniki"

/**
 * Оформление — только до оплаты. Кнопку «Оплатить» не нажимаем никогда.
 *
 * Заказ оформляет только вошедший: гостю вместо формы — вход по коду.
 */
test.describe("оформление", () => {
  test("гость: вместо формы — вход по коду, корзина видна", async ({ page }) => {
    await положитьВКорзину(page)
    await page.goto("/ru/cart")
    await page.locator('[data-testid="checkout-button"]').click()
    await expect(page).toHaveURL(/\/checkout/)
    await expect(page.locator('[data-testid="vhod-dlya-zakaza"]')).toBeVisible()
    await expect(page.getByRole("heading", { name: "Вход для оформления" })).toBeVisible()
    await expect(page.locator('[data-testid="recipient-email-input"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="submit-order-button"]')).toHaveCount(0)
    // сводка заказа справа на месте
    await expect(page.locator('[data-testid="cart-shipping"]')).toBeVisible()
  })

  test("гость: почта без «@» — ошибка, письмо не уходит", async ({ page }) => {
    await положитьВКорзину(page)
    await page.goto("/ru/checkout")
    await page.locator('[data-testid="vhod-pochta"]').fill("anna-mail.ru")
    await page.getByRole("button", { name: "Прислать код" }).click()
    await expect(page.getByText("Кажется, в адресе опечатка")).toBeVisible()
    await expect(page.locator('[data-testid="vhod-kod"]')).toHaveCount(0)
  })

  test("гость: запросил код — открылся ввод кода с таймером повтора", async ({ page }) => {
    await положитьВКорзину(page)
    await page.goto("/ru/checkout")
    await page.locator('[data-testid="vhod-pochta"]').fill(`e2e-ui-${Date.now()}@example.com`)
    await page.getByRole("button", { name: "Прислать код" }).click()
    await expect(page.locator('[data-testid="vhod-kod"]')).toBeVisible()
    await expect(page.getByRole("button", { name: /Прислать ещё раз через \d+ с/ })).toBeDisabled()
    await expect(page.getByRole("button", { name: "Войти" })).toBeDisabled()
  })

  test("вошедший: форма, получатель подставлен из кабинета", async ({ page }) => {
    test.skip(!входДоступен(), "нужны E2E_PK и E2E_KLYUCH")
    const кто = await войтиПокупателем(page)
    await положитьВКорзину(page)
    await page.goto("/ru/checkout")
    await expect(page.locator('[data-testid="vhod-dlya-zakaza"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="recipient-email-input"]')).toHaveValue(кто.почта)
    await expect(page.locator('[data-testid="recipient-phone-input"]')).toHaveValue(/900/)
    await expect(page.locator('input[name="recipient.first_name"]')).toHaveValue(кто.имя)
  })

  test("вошедший: получатель закрыт, пока не выбрана доставка; доставка не «0 ₽»", async ({ page }) => {
    test.skip(!входДоступен(), "нужны E2E_PK и E2E_KLYUCH")
    await войтиПокупателем(page)
    await положитьВКорзину(page)
    await page.goto("/ru/checkout")
    // шаги идут по порядку: город, доставка, получатель — третий под замком
    await expect(page.locator('[data-testid="recipient-email-input"]')).toBeDisabled()
    await expect(page.locator('[data-testid="cart-shipping"]')).toHaveText("после выбора доставки")
    // кнопка оплаты есть, но нажать её нельзя
    await expect(page.locator('[data-testid="submit-order-button"]')).toBeDisabled()
  })

  test("вошёл после того, как собрал корзину, — корзина та же", async ({ page }) => {
    test.skip(!входДоступен(), "нужны E2E_PK и E2E_KLYUCH")
    await положитьВКорзину(page)
    const было = await page.locator('[data-testid="nav-cart-link"]').getAttribute("aria-label")
    await войтиПокупателем(page)
    await page.goto("/ru/checkout")
    // корзина гостя переносится на покупателя
    await expect(page.locator('[data-testid="recipient-email-input"]')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('[data-testid="nav-cart-link"]')).toHaveAttribute("aria-label", было!)
  })

  test("пустая корзина не открывает оформление", async ({ page }) => {
    const ответ = await page.goto("/ru/checkout")
    expect([200, 404]).toContain(ответ?.status())
    await expect(page.locator('[data-testid="submit-order-button"]')).toHaveCount(0)
  })
})
