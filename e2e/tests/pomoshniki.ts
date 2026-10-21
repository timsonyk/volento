import { expect, type Page } from "@playwright/test"

export const ГЛАВНАЯ = "/ru"

/** Первая карточка товара в каталоге — её адрес. */
export async function первыйТовар(page: Page): Promise<string> {
  await page.goto("/ru/store")
  // :visible — в шапке есть скрытые ссылки на товары (панель меню)
  const ссылка = page.locator('a[href*="/products/"]:visible').first()
  await expect(ссылка).toBeVisible()
  return (await ссылка.getAttribute("href"))!
}

/**
 * Выбрать в карточке размер (и рост, если он есть), который есть в
 * наличии. Перечёркнутые варианты пропускаем. true — кнопка «В корзину»
 * стала доступна.
 */
export async function выбратьРазмерВНаличии(page: Page): Promise<boolean> {
  // пока страница дотягивается с сервера, рядом с настоящей кнопкой
  // ещё стоит заглушка из Suspense — ждём, пока она уйдёт
  await page.waitForLoadState("networkidle")
  const группы = page.locator('[data-testid="product-options"]')
  const сколькоГрупп = await группы.count()
  const кнопка = page.locator('[data-testid="add-product-button"]')

  if (!сколькоГрупп) {
    return await кнопка.isEnabled()
  }

  const первая = группы.nth(0).locator('[data-testid="option-button"]')
  const вариантов = await первая.count()

  for (let i = 0; i < вариантов; i++) {
    const в = первая.nth(i)
    if ((await в.getAttribute("class"))?.includes("line-through")) continue
    await в.click()
    // выбор размера меняет адрес (?v_id) и перерисовывает кнопку
    await page.waitForTimeout(800)

    for (let г = 1; г < сколькоГрупп; г++) {
      const кнопки = группы.nth(г).locator('[data-testid="option-button"]')
      const n = await кнопки.count()
      for (let j = 0; j < n; j++) {
        const к = кнопки.nth(j)
        const перечёркнут = await к.evaluate((el) =>
          Boolean(el.className.includes("line-through") || el.querySelector(".line-through"))
        )
        if (!перечёркнут) {
          await к.click()
          await page.waitForTimeout(800)
          break
        }
      }
    }

    if (await кнопка.isEnabled()) {
      await expect(кнопка).toContainText("В корзину")
      return true
    }
  }
  return false
}

/** Кладёт в корзину первый товар каталога, у которого есть размер. */
export async function положитьВКорзину(page: Page) {
  await page.goto("/ru/store")
  const ссылки = await page
    .locator('a[href*="/products/"]:visible')
    .evaluateAll((a) => [...new Set(a.map((x) => x.getAttribute("href")!))].slice(0, 6))

  for (const адрес of ссылки) {
    await page.goto(адрес)
    if (await выбратьРазмерВНаличии(page)) {
      await page.locator('[data-testid="add-product-button"]').click()
      // счётчик на значке корзины в шапке
      await expect(page.locator('[data-testid="nav-cart-link"]')).toHaveAttribute(
        "aria-label",
        /товаров: [1-9]/
      )
      return адрес
    }
  }
  throw new Error("Ни у одного из первых товаров каталога нет размера в наличии")
}

const API = process.env.E2E_API || "http://127.0.0.1:9000"

/** Можно ли войти покупателем: нужны ключ витрины и ключ автотестов сервера. */
export const входДоступен = () => Boolean(process.env.E2E_PK && process.env.E2E_KLYUCH)

/**
 * Входит покупателем с новой почтой @example.com, без письма: сервер с
 * ключом E2E_KLYUCH отдаёт код в ответе (backend/src/api/store/vhod).
 * Кука ставится в браузер — дальше витрина видит вошедшего.
 */
export async function войтиПокупателем(
  page: Page,
  кто = { имя: "Анна", фамилия: "Тестова", телефон: "+7 900 000-00-00" }
) {
  const почта = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
  const pk = { "x-publishable-api-key": process.env.E2E_PK!, "Content-Type": "application/json" }

  const выдан = await fetch(`${API}/store/vhod`, {
    method: "POST",
    headers: { ...pk, "x-e2e-klyuch": process.env.E2E_KLYUCH! },
    body: JSON.stringify({ email: почта }),
  }).then((r) => r.json())
  if (!выдан.код) throw new Error(`Код не выдан: ${JSON.stringify(выдан)}`)

  const { token: личность } = await fetch(`${API}/auth/customer/kod`, {
    method: "POST",
    headers: pk,
    body: JSON.stringify({ email: почта, code: выдан.код }),
  }).then((r) => r.json())
  if (!личность) throw new Error("Вход по коду не выдал ключ")

  const заведён = await fetch(`${API}/store/customers`, {
    method: "POST",
    headers: { ...pk, authorization: `Bearer ${личность}` },
    body: JSON.stringify({ email: почта, first_name: кто.имя, last_name: кто.фамилия, phone: кто.телефон }),
  })
  if (!заведён.ok) throw new Error(`Покупатель не заведён: ${заведён.status}`)

  const { token } = await fetch(`${API}/auth/token/refresh`, {
    method: "POST",
    headers: { ...pk, authorization: `Bearer ${личность}` },
  }).then((r) => r.json())

  const адрес = new URL(process.env.E2E_BASE || "http://127.0.0.1:8000")
  await page.context().addCookies([
    { name: "_medusa_jwt", value: token, domain: адрес.hostname, path: "/", httpOnly: true, sameSite: "Strict", secure: адрес.protocol === "https:" },
  ])
  return { почта, ...кто }
}
