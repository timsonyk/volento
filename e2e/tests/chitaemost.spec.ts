import { expect, test, type Page } from "@playwright/test"

import { первыйТовар } from "./pomoshniki"

/**
 * Текст на страницах читается: контраст с фоном не ниже 4,5 (для крупного
 * текста не ниже 3), как в общепринятых правилах доступности.
 *
 * Не считаем то, что бледное по замыслу: зачёркнутое (старая цена, размер
 * не в наличии), выключенные кнопки и текст поверх картинок.
 */
const бледныйТекст = (page: Page) =>
  page.evaluate(() => {
    type Цвет = { r: number; g: number; b: number; a: number }
    const разобрать = (с: string): Цвет => {
      const ч = (с.match(/[\d.]+/g) || []).map(Number)
      return { r: ч[0], g: ч[1], b: ч[2], a: ч[3] ?? 1 }
    }
    const яркость = (ц: { r: number; g: number; b: number }) => {
      const д = (v: number) => {
        v /= 255
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * д(ц.r) + 0.7152 * д(ц.g) + 0.0722 * д(ц.b)
    }
    const фон = (эл: Element | null): Цвет | null => {
      for (; эл; эл = эл.parentElement) {
        const с = getComputedStyle(эл)
        if (с.backgroundImage !== "none") return null
        const ц = разобрать(с.backgroundColor)
        if (ц.a > 0.95) return ц
        if (ц.a > 0.05) return null
      }
      return { r: 255, g: 255, b: 255, a: 1 }
    }
    const найдено = new Map<string, string>()
    const обход = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let узел = обход.nextNode(); узел; узел = обход.nextNode()) {
      const текст = (узел.textContent || "").trim()
      const эл = узел.parentElement
      if (!эл || текст.length < 2 || !эл.offsetParent) continue
      if (эл.closest("[disabled], [aria-disabled='true'], [aria-hidden='true'], img, picture")) continue
      const с = getComputedStyle(эл)
      if (с.visibility === "hidden" || с.textDecorationLine.includes("line-through")) continue
      const рамка = эл.getBoundingClientRect()
      if (рамка.width < 2 || рамка.height < 2) continue
      let видимость = 1
      let зачёркнут = false
      for (let п: Element | null = эл; п; п = п.parentElement) {
        const сп = getComputedStyle(п)
        видимость *= parseFloat(сп.opacity)
        зачёркнут ||= сп.textDecorationLine.includes("line-through")
      }
      if (видимость === 0 || зачёркнут) continue
      const ф = фон(эл)
      if (!ф) continue
      const ц0 = разобрать(с.color)
      const а = ц0.a * видимость
      const ц = {
        r: ц0.r * а + ф.r * (1 - а),
        g: ц0.g * а + ф.g * (1 - а),
        b: ц0.b * а + ф.b * (1 - а),
      }
      const я1 = яркость(ц)
      const я2 = яркость(ф)
      const контраст = (Math.max(я1, я2) + 0.05) / (Math.min(я1, я2) + 0.05)
      const размер = parseFloat(с.fontSize)
      const крупный = размер >= 24 || (размер >= 18.66 && parseInt(с.fontWeight) >= 700)
      // 4,45: запас на округление, наш серый #767676 даёт ровно 4,54
      if (контраст < (крупный ? 3 : 4.45)) {
        const ключ = `${контраст.toFixed(2)} ${Math.round(размер)}px ${эл.tagName.toLowerCase()}.${String(эл.className).slice(0, 60)}`
        if (!найдено.has(ключ)) найдено.set(ключ, текст.slice(0, 40))
      }
    }
    return [...найдено].map(([ключ, текст]) => `${ключ} «${текст}»`)
  })

test.describe("читаемость текста", () => {
  test("на главных страницах нет бледного текста", async ({ page }) => {
    test.setTimeout(120_000)
    const товар = await первыйТовар(page)
    for (const адрес of ["/ru", "/ru/store", товар, "/ru/cart", "/ru/account", "/ru/dostavka", "/ru/vozvrat"]) {
      await page.goto(адрес)
      await page.waitForLoadState("networkidle").catch(() => {})
      // плашка про cookie тоже в счёт, поэтому согласие заранее не ставим
      expect(await бледныйТекст(page), адрес).toEqual([])
    }
  })

  test("проверка сама ловит бледный текст", async ({ page }) => {
    await page.goto("/ru/dostavka")
    await page.evaluate(() => {
      const п = document.createElement("p")
      п.textContent = "Проверочная бледная строка"
      п.style.color = "#bbbbbb"
      document.querySelector("main")!.prepend(п)
    })
    const найдено = await бледныйТекст(page)
    expect(найдено).toHaveLength(1)
    expect(найдено[0]).toContain("Проверочная бледная строка")
  })
})
