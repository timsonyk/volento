import { expect, test } from "@playwright/test"

import { войтиПокупателем, выданныйЗаказ, складДоступен } from "./pomoshniki"

/**
 * Возврат через кабинет: заказ выдан, покупатель отмечает пары и подаёт
 * заявку. Заказы тестовые — в службу не уходят, денег нет.
 */
test.describe("возврат через кабинет", () => {
  test.skip(!складДоступен(), "нужны E2E_PK, E2E_KLYUCH и E2E_SKLAD")

  test("оформить возврат одной пары из трёх", async ({ page }) => {
    const кто = await войтиПокупателем(page)
    const заказ = await выданныйЗаказ(кто.почта)

    await page.goto(`/ru/account/orders/details/${заказ.id}`)
    const блок = page.locator('[data-testid="vozvrat"]')
    await expect(блок).toBeVisible()
    await expect(блок).toContainText("Вернуть можно до")

    await page.locator('[data-testid="vozvrat-otkryt"]').click()
    const пары = page.locator('[data-testid="vozvrat-para"]')
    await expect(пары).toHaveCount(3)
    // одинаковые пары подписаны номерами
    await expect(page.locator('[data-testid="vozvrat-forma"]')).toContainText("пара 2 из 2")

    const отправить = page.locator('[data-testid="vozvrat-otpravit"]')
    await expect(отправить).toBeDisabled()
    await пары.first().check()
    await expect(отправить).toHaveText("Вернуть 1 шт.")
    await page.locator('[data-testid="vozvrat-prichina"]', { hasText: "Не подошёл размер" }).click()
    await page.locator('[data-testid="vozvrat-kommentariy"]').fill("велики в талии")
    await отправить.click()

    await expect(page.locator('[data-testid="vozvrat-gotovo"]')).toContainText(`Заявка ${заказ.nomer}-В1 принята`)
    await expect(page.locator('[data-testid="vozvrat-zayavki"]')).toContainText("1 шт., ждём посылку")

    // оставшиеся две пары можно вернуть следующей заявкой
    await page.locator('[data-testid="vozvrat-otkryt"]').click()
    await expect(page.locator('[data-testid="vozvrat-para"]')).toHaveCount(2)

    // после перезагрузки заявка на месте
    await page.reload()
    await expect(page.locator('[data-testid="vozvrat-zayavki"]')).toContainText(`${заказ.nomer}-В1`)
  })

  test("чужой заказ: блока возврата нет", async ({ page }) => {
    const первый = await войтиПокупателем(page)
    const заказ = await выданныйЗаказ(первый.почта, [1])
    await page.context().clearCookies()
    await войтиПокупателем(page, { имя: "Борис", фамилия: "Чужой", телефон: "+7 900 000-00-02" })
    await page.goto(`/ru/account/orders/details/${заказ.id}`)
    await expect(page.locator('[data-testid="vozvrat-otkryt"]')).toHaveCount(0)
  })
})
