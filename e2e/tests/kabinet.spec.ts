import { expect, test } from "@playwright/test"

import { войтиПокупателем, входДоступен } from "./pomoshniki"

test.describe("кабинет: правка профиля", () => {
  test.skip(!входДоступен(), "нужны E2E_PK и E2E_KLYUCH")

  test("телефон: буквы не сохраняются, номер приводится к общему виду", async ({ page }) => {
    await войтиПокупателем(page)
    await page.goto("/ru/account/profile")
    const блок = page.locator('[data-testid="account-phone-editor"]')
    const поле = блок.locator('[data-testid="phone-input"]')

    await блок.locator('[data-testid="edit-button"]').click()
    await поле.fill("123")
    await блок.locator('[data-testid="save-button"]').click()
    await expect(блок.locator('[data-testid="error-message"]')).toContainText("11 цифр")

    await поле.fill("89123456789")
    await expect(поле).toHaveValue("+7 912 345-67-89")
    await блок.locator('[data-testid="save-button"]').click()
    await expect(блок.locator('[data-testid="current-info"]')).toHaveText("+7 912 345-67-89")

    // второе сохранение подряд тоже проходит и не зависает
    await блок.locator('[data-testid="edit-button"]').click()
    await поле.fill("89120000000")
    await блок.locator('[data-testid="save-button"]').click()
    await expect(блок.locator('[data-testid="current-info"]')).toHaveText("+7 912 000-00-00")
  })

  test("свёрнутая форма не перекрывает то, что под ней", async ({ page }) => {
    await войтиПокупателем(page)
    await page.goto("/ru/account/profile")
    const ссылка = page.locator('[data-testid="account-email"] a[href^="mailto:"]')
    await expect(ссылка).toBeVisible()
    // trial: проверяем, что нажатие дошло бы до ссылки, но почту не открываем
    await ссылка.click({ trial: true, timeout: 5000 })
    await expect(page.locator('[data-testid="save-button"]:visible')).toHaveCount(0)
  })

  test("имя: пустое не сохраняется", async ({ page }) => {
    await войтиПокупателем(page)
    await page.goto("/ru/account/profile")
    const блок = page.locator('[data-testid="account-name-editor"]')
    const было = await блок.locator('[data-testid="current-info"]').innerText()

    await блок.locator('[data-testid="edit-button"]').click()
    await блок.locator('[data-testid="first-name-input"]').fill("   ")
    await блок.locator('[data-testid="save-button"]').click()
    await expect(блок.locator('[data-testid="error-message"]')).toContainText("Нужны имя и фамилия")
    await page.reload()
    await expect(блок.locator('[data-testid="current-info"]')).toHaveText(было)
  })
})

test.describe("сбой страницы", () => {
  test("покупатель видит нашу заглушку с дорогой на главную", async ({ page }) => {
    await page.goto("/ru/proverka-sboya")
    const заглушка = page.locator('[data-testid="stranica-sboya"]')
    await expect(заглушка).toBeVisible()
    await expect(заглушка.locator("h1")).toHaveText("Не получилось открыть страницу")
    await expect(page.locator("body")).not.toContainText("Application error")
    await заглушка.getByRole("link", { name: "На главную", exact: true }).click()
    await expect(page).toHaveURL(/\/ru$/)
  })
})

test.describe("ссылка на заказ из письма", () => {
  test("гостю предлагают войти, а не «страница не найдена»", async ({ page }) => {
    await page.goto("/ru/order/order_net_takogo/confirmed")
    await expect(page.locator('[data-testid="zakaz-nuzhen-vhod"]')).toBeVisible()
    await expect(page.locator("h1")).toHaveText("Войдите, чтобы открыть заказ")
    await expect(page.locator('[data-testid="vhod-pochta"]')).toBeVisible()
  })

  test("вошедшему чужой или несуществующий заказ не показывается", async ({ page }) => {
    test.skip(!входДоступен(), "нужны E2E_PK и E2E_KLYUCH")
    await войтиПокупателем(page)
    await page.goto("/ru/order/order_net_takogo/confirmed")
    await expect(page.locator('[data-testid="zakaz-nuzhen-vhod"]')).toHaveCount(0)
    await expect(page.locator("h1")).toContainText("не найдена")
  })
})
