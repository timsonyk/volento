import { expect, test } from "@playwright/test"

import { выбратьРазмерВНаличии, первыйТовар, положитьВКорзину } from "./pomoshniki"

test.describe("корзина", () => {
  test("до выбора размера кнопка просит выбрать, а не пишет «нет в наличии»", async ({ page }) => {
    await page.goto(await первыйТовар(page))
    await page.waitForLoadState("networkidle")
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

  // Раньше примерно каждая седьмая смена количества ждала три секунды:
  // React терял сигнал о готовых данных, и выручал только запасной повтор
  // через две секунды. Теперь страницу будит «будильник» в корневом макете.
  test("смена количества не зависает на запасном повторе", async ({ page }) => {
    test.setTimeout(120000)
    await положитьВКорзину(page)
    await page.goto("/ru/cart")
    const строка = page.locator('[data-testid="product-row"]:visible').first()
    await expect(строка).toBeVisible()
    const количество = строка.locator('[data-testid="product-select-button"]')
    test.skip((await количество.locator("option").count()) < 2, "в наличии одна штука")
    await expect(количество).toBeEnabled()
    const итог = page.locator('[data-testid="cart-subtotal"]')
    // Один редкий долгий шаг прощаем (примерно один на несколько сотен
    // остаётся и после правки, его добирает запасной повтор). До правки
    // долгим был каждый седьмой, из 30 шагов их набиралось четыре и больше.
    let долгих = 0
    for (let шаг = 0; шаг < 30; шаг++) {
      const до = await итог.innerText()
      const надо = шаг % 2 === 0 ? "2" : "1"
      await количество.selectOption(надо)
      // выбранное число видно сразу, без возврата к прежнему
      expect(await количество.inputValue()).toBe(надо)
      const с = Date.now()
      await expect(итог).not.toHaveText(до, { timeout: 15000 })
      if (Date.now() - с > 1900) долгих++
      await expect(строка.locator("svg.animate-spin")).toHaveCount(0)
    }
    expect(долгих, "долгих смен количества из 30").toBeLessThan(3)
  })

  test("перечёркнутый размер не даёт купить", async ({ page }) => {
    await page.goto("/ru/store")
    // каталог приходит потоком: без ожидания список адресов бывал пустым
    await page.locator('a[href*="/products/"]:visible').first().waitFor()
    const адреса = await page
      .locator('a[href*="/products/"]:visible')
      .evaluateAll((a) => [...new Set(a.map((x) => x.getAttribute("href")!))].slice(0, 8))

    for (const адрес of адреса) {
      await page.goto(адрес)
      await page.waitForLoadState("networkidle")
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

test.describe("сбой в корзине", () => {
  test("удаление не прошло: строка на месте, под значком понятный текст", async ({ page }) => {
    await положитьВКорзину(page)
    await page.goto("/ru/cart")
    const строка = page.locator('[data-testid="product-row"]:visible').first()
    await expect(строка).toBeVisible()

    // обрываем связь только для действий (они идут POST на адрес страницы)
    await page.route("**/ru/cart**", (r) =>
      r.request().method() === "POST" ? r.abort() : r.continue()
    )
    await строка.locator('[data-testid="product-delete-button"]').click()
    await expect(строка.locator('[data-testid="udalenie-sboy"]')).toBeVisible()
    await expect(строка).toBeVisible()
    const ширина = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
    expect(ширина[0]).toBeLessThanOrEqual(ширина[1] + 1)

    // связь вернулась: удаление проходит
    await page.unroute("**/ru/cart**")
    await строка.locator('[data-testid="product-delete-button"]').click()
    await expect(page.locator('[data-testid="empty-cart-message"]')).toBeVisible()
  })
})
