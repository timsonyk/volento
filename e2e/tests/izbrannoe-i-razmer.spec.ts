import { expect, test } from "@playwright/test"

import { выбратьРазмерВНаличии, первыйТовар } from "./pomoshniki"

test.describe("избранное", () => {
  test("сердечко на карточке откладывает вещь и не открывает её", async ({ page }) => {
    await page.goto("/ru/categories/bryuki")
    const сердечки = page.locator('[data-testid="serdechko"]')
    await expect(сердечки.first()).toBeVisible()
    await сердечки.nth(0).click()
    await сердечки.nth(1).click()
    await expect(page).toHaveURL(/\/ru\/categories\/bryuki/)
    await expect(сердечки.nth(0)).toHaveAttribute("aria-pressed", "true")

    await page.goto("/ru/izbrannoe")
    const список = page.locator('[data-testid="izbrannoe-spisok"] li')
    await expect(список).toHaveCount(2)
    // свежие карточки приходят с ценой, как в каталоге
    await expect(page.locator('[data-testid="izbrannoe-veshch"] [data-testid="product-wrapper"]')).toHaveCount(2)
    await expect(список.first()).toContainText("₽")
    await page.getByRole("button", { name: "Убрать", exact: true }).first().click()
    await expect(список).toHaveCount(1)
    await список.first().locator("a").click()
    await expect(page).toHaveURL(/\/products\//)
  })

  test("снятая с продажи вещь помечена и не ведёт на пустую страницу", async ({ page }) => {
    await page.goto("/ru/dostavka")
    await page.evaluate(() =>
      localStorage.setItem(
        "volento_izbrannoe",
        JSON.stringify([{ handle: "takoy-veshchi-net-e2e", title: "Снятая вещь", thumbnail: null }])
      )
    )
    await page.goto("/ru/izbrannoe")
    const снятая = page.locator('[data-testid="izbrannoe-snyata"]')
    await expect(снятая).toBeVisible()
    await expect(снятая).toContainText("Больше не продаётся")
    await expect(снятая.locator("a")).toHaveCount(0)
    await снятая.getByRole("button", { name: "Убрать", exact: true }).click()
    await expect(page.locator('[data-testid="izbrannoe-pusto"]')).toBeVisible()
  })

  test("кнопка на товаре: отметка переживает перезагрузку", async ({ page }) => {
    await page.goto(await первыйТовар(page))
    const кнопка = page.locator('[data-testid="v-izbrannoe"]')
    await expect(кнопка).toHaveText("В избранное")
    await кнопка.click()
    await expect(кнопка).toHaveText("В избранном")
    await page.reload()
    await expect(кнопка).toHaveText("В избранном")
    await page.getByRole("link", { name: "Открыть избранное" }).click()
    await expect(page.locator('[data-testid="izbrannoe-spisok"] li')).toHaveCount(1)
  })

  test("пустое избранное зовёт в каталог", async ({ page }) => {
    await page.goto("/ru/izbrannoe")
    await expect(page.locator('[data-testid="izbrannoe-pusto"]')).toBeVisible()
    await page.getByRole("link", { name: "Смотреть каталог" }).click()
    await expect(page).toHaveURL(/\/ru\/store/)
  })
})

test.describe("мой размер", () => {
  test("выбранный размер подставляется при следующем заходе", async ({ page }) => {
    const товар = await первыйТовар(page)
    await page.goto(товар)
    await expect(page.locator('[data-testid="moy-razmer"]')).toHaveCount(0)
    test.skip(!(await выбратьРазмерВНаличии(page)), "у первого товара нет размеров в наличии")

    // тот же товар открываем заново, без ?v_id: размер должен встать сам
    await page.goto(товар)
    await expect(page.locator('[data-testid="moy-razmer"]')).toBeVisible()
    await expect(page.locator('[data-testid="add-product-button"]').first()).toContainText("В корзину")
  })
})

test.describe("адреса и пустые страницы", () => {
  test("адрес с заглавным кодом страны ведёт на обычный", async ({ page }) => {
    await page.goto("/RU/store")
    await expect(page).toHaveURL(/\/ru\/store/)
    await expect(page.locator('a[href*="/products/"]:visible').first()).toBeVisible()
  })

  test("во вкладке поиска видно, что искали", async ({ page }) => {
    await page.goto("/ru/search?q=брюки")
    await expect(page).toHaveTitle("Поиск: брюки | Volento")
  })

  test("над товаром есть раздел каталога", async ({ page }) => {
    await page.goto("/ru/categories/bryuki")
    await page.locator('a[href*="/products/"]:visible').first().click()
    await expect(
      page.locator('nav[aria-label="Вы здесь"] a[href*="/categories/"]').first()
    ).toBeVisible()
  })
})

test.describe("кривые адреса каталога", () => {
  test("поиск с повторённым словом в адресе не падает", async ({ page }) => {
    await page.goto("/ru/search?q=bryuki&q=yubki")
    await expect(page.locator("h1")).toContainText("Поиск: bryuki")
    await expect(page.locator('[data-testid="stranica-sboya"]')).toHaveCount(0)
  })

  test("неизвестная сортировка открывает обычный список", async ({ page }) => {
    await page.goto("/ru/categories/bryuki?sortBy=abc")
    await expect(page.locator('[data-testid="product-wrapper"]').first()).toBeVisible()
  })

  test("номер страницы буквами открывает первую страницу", async ({ page }) => {
    await page.goto("/ru/store?page=abc")
    await expect(page.locator('[data-testid="product-wrapper"]').first()).toBeVisible()
  })

  test("страницы за концом списка нет, ссылка ведёт в начало", async ({ page }) => {
    await page.goto("/ru/categories/bryuki?page=999")
    const нет = page.locator('[data-testid="net-takoy-stranicy"]')
    await expect(нет).toBeVisible()
    await нет.getByRole("link", { name: "Перейти в начало" }).click()
    await expect(page.locator('[data-testid="product-wrapper"]').first()).toBeVisible()
    await expect(page).not.toHaveURL(/page=/)
  })

  test("фильтр без находок советует снять фильтры", async ({ page }) => {
    await page.goto("/ru/categories/bryuki?" + new URLSearchParams({ "цвет": "нет-такого" }))
    await expect(page.getByText("По выбранным условиям ничего не нашлось")).toBeVisible()
  })
})

test.describe("«Вы смотрели» и согласие на cookie", () => {
  const естьКука = async (page: import("@playwright/test").Page) =>
    (await page.context().cookies()).some((к) => к.name === "smotreli")

  test("cookie просмотров пишется только после «Принять»", async ({ page }) => {
    await page.goto(await первыйТовар(page))
    await expect(page.locator('[data-testid="product-container"]')).toBeVisible()
    await page.waitForTimeout(1500)
    expect(await естьКука(page)).toBe(false)

    await page.evaluate(() =>
      localStorage.setItem(
        "volento_cookie_consent",
        JSON.stringify({ версия: 2, решение: "принято", когда: new Date().toISOString() })
      )
    )
    await page.reload()
    await expect.poll(() => естьКука(page)).toBe(true)

    await page.evaluate(() =>
      localStorage.setItem(
        "volento_cookie_consent",
        JSON.stringify({ версия: 2, решение: "только необходимые", когда: new Date().toISOString() })
      )
    )
    await page.reload()
    await expect.poll(() => естьКука(page)).toBe(false)
  })
})

test.describe("названия цветов", () => {
  test("цвет на странице товара показан с буквой «ё»", async ({ page }) => {
    await page.goto("/ru/search?" + new URLSearchParams({ q: "чёрные брюки" }))
    const карточка = page.locator('a[href*="/products/"]:has([data-testid="product-wrapper"])').first()
    await expect(карточка).toBeVisible()
    await page.goto((await карточка.getAttribute("href"))!)
    await expect(page.getByText(/Цвет:\s*чёрн/)).toBeVisible()
    await expect(page.locator('[data-testid="product-colors"] a[aria-label*="черн"]')).toHaveCount(0)
  })
})

test.describe("пустой раздел", () => {
  test("поисковику не показывается, обычный раздел показывается", async ({ page }) => {
    await page.goto("/ru/categories/muzhskie-rubashki")
    await expect(page.locator('[data-testid="pustoy-razdel"]')).toBeVisible()
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1)
    await page.goto("/ru/categories/bryuki")
    await expect(page.locator('[data-testid="product-wrapper"]').first()).toBeVisible()
  })
})
