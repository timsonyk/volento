import { expect, Page, test } from "@playwright/test"

import { войтиПокупателем, входДоступен } from "./pomoshniki"

/** «Сообщить, когда появится» у размера, которого нет. */

/** Открывает товар и выбирает размер, которого нет. false, если такого не нашлось. */
async function выбратьРазмерКоторогоНет(page: Page): Promise<boolean> {
  await page.goto("/ru/store")
  const адреса = await page
    .locator('a[href*="/products/"]:visible')
    .evaluateAll((a) => [...new Set(a.map((x) => x.getAttribute("href")!))].slice(0, 8))

  for (const адрес of адреса) {
    await page.goto(адрес)
    await page.waitForLoadState("networkidle")
    const нет = page.locator('[data-testid="option-button"].line-through').first()
    if (!(await нет.count())) continue
    await нет.click()
    const кнопка = page.locator('[data-testid="add-product-button"]')
    // у брюк кроме размера есть рост: добираем, пока вариант не выбран целиком
    const прочие = page.locator('[data-testid="option-button"]')
    const сколько = await прочие.count()
    for (let i = 0; i < сколько; i++) {
      if ((await кнопка.textContent())?.includes("Нет в наличии")) return true
      const п = прочие.nth(i)
      if (await п.evaluate((э) => э.classList.contains("line-through"))) await п.click()
    }
    if ((await кнопка.textContent())?.includes("Нет в наличии")) return true
  }
  return false
}

test.describe("сообщить, когда появится", () => {
  test("размер в наличии: блока нет", async ({ page }) => {
    await page.goto("/ru/store")
    await page.locator('a[href*="/products/"]:visible').first().click()
    await expect(page).toHaveURL(/\/products\//)
    await expect(page.locator('[data-testid="zhdu"]')).toHaveCount(0)
  })

  test("гостю предлагают войти", async ({ page }) => {
    test.skip(!(await выбратьРазмерКоторогоНет(page)), "нет размера без наличия")
    await page.locator('[data-testid="zhdu-knopka"]').click()
    await expect(page.locator('[data-testid="zhdu-vhod"]')).toBeVisible()
  })

  test("вошедшему пишем, что запомнили, и страница не шире экрана", async ({ page }) => {
    test.skip(!входДоступен(), "нет ключей для входа")
    await войтиПокупателем(page)
    test.skip(!(await выбратьРазмерКоторогоНет(page)), "нет размера без наличия")
    await page.locator('[data-testid="zhdu-knopka"]').click()
    await expect(page.locator('[data-testid="zhdu-zapisali"]')).toContainText("Запомнили")
    const шире = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    )
    expect(шире).toBe(false)

    // просьба видна в кабинете, и её можно снять
    await page.goto("/ru/account/profile")
    const список = page.locator('[data-testid="zhdu-spisok"]')
    await expect(список).toBeVisible()
    await expect(список.locator('[data-testid="zhdu-stroka"] a').last()).toHaveAttribute(
      "href",
      /\/products\/.+v_id=variant_/
    )
    const строки = список.locator('[data-testid="zhdu-stroka"]')
    for (let осталось = await строки.count(); осталось > 0; осталось--) {
      await строки.first().locator('[data-testid="zhdu-ubrat"]').click()
      await expect(строки).toHaveCount(осталось - 1)
    }
    await expect(список).toHaveCount(0)
    await page.reload()
    await expect(page.locator('[data-testid="profile-page-wrapper"]')).toBeVisible()
    await expect(page.locator('[data-testid="zhdu-spisok"]')).toHaveCount(0)
  })
})
