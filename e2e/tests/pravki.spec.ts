import { expect, test } from "@playwright/test"

/**
 * Правки со встречи 23 октября: меню каталога, плитки главной, таблица
 * размеров и увеличение фото в карточке.
 */
const ТОВАР_С_ТАБЛИЦЕЙ = "/ru/products/bryuki-palacco-klassicheskie-kapuchino"

test.describe("правки 23 октября", () => {
  test("главная: плитки разделов с подписью над фото", async ({ page }) => {
    await page.goto("/ru")
    const плитки = page.locator("#siluety li")
    await expect(плитки).toHaveCount(4)
    for (const имя of ["Женские брюки", "Юбки", "Рубашки", "Мужские брюки"]) {
      await expect(page.locator("#siluety").getByText(имя, { exact: true })).toBeVisible()
    }
    await expect(page.locator("#siluety").getByText("Блузки", { exact: true })).toHaveCount(0)
  })

  test("меню «Каталог»: панель слева, без пустых разделов, закрывается", async ({ page, isMobile }) => {
    test.skip(isMobile, "на телефоне своя шторка")
    await page.goto("/ru")
    const панель = page.locator('[data-testid="panel-katalog"]')
    await page.locator('[data-testid="menu-katalog"]').click()
    await expect(панель).toBeInViewport()
    await expect(панель.getByText("Женщинам")).toBeVisible()
    await expect(панель.getByText("Мужчинам")).toBeVisible()
    // мужских рубашек в продаже нет — пункта нет
    await expect(панель.locator('a[href*="muzhskie-rubashki"]')).toHaveCount(0)
    await expect(панель.locator("img")).toHaveCount(0)
    await page.keyboard.press("Escape")
    await expect(панель).not.toBeInViewport()

    await page.locator('[data-testid="menu-katalog"]').click()
    await панель.getByRole("link", { name: "Юбки" }).click()
    await expect(page).toHaveURL(/\/categories\/yubki/)
    await expect(панель).not.toBeInViewport()
  })

  test("шторка на телефоне без фотографии и без пустых разделов", async ({ page, isMobile }) => {
    test.skip(!isMobile, "только телефон")
    await page.goto("/ru")
    await page.locator('[data-testid="nav-menu-button"]').click()
    const шторка = page.locator('[data-testid="nav-menu-popup"]')
    await expect(шторка).toBeVisible()
    await expect(шторка.locator('a[href*="muzhskie-rubashki"]')).toHaveCount(0)
    // в шторке только логотип, снимка под разделами нет
    await expect(шторка.locator("img")).toHaveCount(1)
  })

  test("карточка: таблица мерок не в галерее, а по кнопке", async ({ page }) => {
    await page.goto(ТОВАР_С_ТАБЛИЦЕЙ)
    const кнопка = page.locator('[data-testid="tablica-razmerov"]')
    await expect(кнопка).toBeVisible()
    await кнопка.click()
    const окно = page.locator('[data-testid="prosmotr"]')
    await expect(окно).toBeVisible()
    await expect(окно.getByRole("img", { name: /Таблица размеров/ })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(окно).toHaveCount(0)

    // в галерее снимков на один меньше, чем у товара: таблицу убрали
    const снимков = await page.locator('[data-testid="product-gallery"] button').count()
    expect(снимков).toBeGreaterThan(0)
  })

  test("карточка: фото увеличивается по нажатию и закрывается", async ({ page }) => {
    await page.goto(ТОВАР_С_ТАБЛИЦЕЙ)
    await page.locator('[data-testid="product-gallery"] button').first().click()
    const окно = page.locator('[data-testid="prosmotr"]')
    await expect(окно).toBeVisible()
    await page.getByRole("button", { name: "Закрыть" }).click()
    await expect(окно).toHaveCount(0)
  })

  test("карточка на компьютере: снимок целиком в экране", async ({ page, isMobile }) => {
    test.skip(isMobile, "на телефоне листалка вбок")
    await page.goto(ТОВАР_С_ТАБЛИЦЕЙ)
    const снимок = page.locator('[data-testid="product-gallery"] button').first()
    const рамка = await снимок.boundingBox()
    const окно = page.viewportSize()!
    expect(рамка!.y + рамка!.height).toBeLessThanOrEqual(окно.height)
  })

  test("каталог: последний ряд полный", async ({ page, isMobile }) => {
    test.skip(isMobile, "на телефоне два в ряд — всегда полный")
    await page.goto("/ru/store")
    await expect(page.locator('[data-testid="products-list"] li')).toHaveCount(24)
  })
})
