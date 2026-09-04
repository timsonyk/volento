/**
 * Заводит боевой каталог из складской выгрузки.
 *
 * Данные готовит build-catalog.py, он кладёт рядом catalog.json:
 * товар = модель + цвет, вариант = размер + рост.
 *
 * Свои артикулы: товар VLT-0001, вариант VLT-0001-46-170. Артикул склада
 * не используем как SKU — он не наш и может поменяться, поэтому лежит в
 * metadata. В каждом варианте есть wh_key вида «артикул-размер-рост» —
 * это ключ, по которому склад Максима будет присылать остатки по API.
 *
 * Товары заводятся ЧЕРНОВИКАМИ: в выгрузке склада колонки с ценой нет.
 * Medusa не создаёт вариант совсем без цены, поэтому ставится заглушка
 * 1 ₽ — её невозможно принять за настоящую цену, в отличие от красивого
 * round числа. У товара стоит metadata.price_pending = true, по нему
 * заглушки потом легко найти. Черновик не виден на витрине и не
 * покупается, так что продать по 1 ₽ нельзя.
 *
 * Запуск на сервере:
 *   node import-catalog.js                 — весь каталог
 *   node import-catalog.js --limit 2       — только первые 2 товара (проба)
 *   node import-catalog.js --stock         — только обновить остатки
 */

const fs = require("fs")
const path = require("path")

const BASE = "http://127.0.0.1:9000"
const DATA = process.env.CATALOG_JSON || path.join(__dirname, "catalog.json")

const args = process.argv.slice(2)
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity
const STOCK_ONLY = args.includes("--stock")
// цену можно задать одну на всех: node import-catalog.js --price 5900
const PLACEHOLDER = 1
const PRICE = args.includes("--price") ? Number(args[args.indexOf("--price") + 1]) : PLACEHOLDER

let TOKEN = ""

async function api(method, endpoint, body) {
  for (let attempt = 1; ; attempt++) {
    let res
    try {
      res = await fetch(BASE + endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    } catch (e) {
      if (attempt >= 3) throw e
      await new Promise((r) => setTimeout(r, 2000))
      continue
    }
    const json = await res.json().catch(() => ({}))
    if (res.ok) return json
    // 5xx — бэкенд мог подавиться, пробуем ещё раз
    if (res.status >= 500 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 2000))
      continue
    }
    throw new Error(`${method} ${endpoint} -> ${res.status} ${JSON.stringify(json).slice(0, 400)}`)
  }
}

/** Постранично забирает список целиком. */
async function all(endpoint, key, fields) {
  const out = []
  const step = 500
  for (let offset = 0; ; offset += step) {
    const sep = endpoint.includes("?") ? "&" : "?"
    const q = `${endpoint}${sep}limit=${step}&offset=${offset}${fields ? "&fields=" + fields : ""}`
    const page = await api("GET", q)
    out.push(...page[key])
    if (out.length >= page.count || page[key].length === 0) return out
  }
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(DATA, "utf8")).slice(0, LIMIT)
  console.log(`в файле товаров: ${catalog.length}, вариантов: ${catalog.reduce((s, p) => s + p.variants.length, 0)}`)

  TOKEN = (
    await api("POST", "/auth/user/emailpass", {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
  ).token

  const [{ stock_locations }, { sales_channels }, { shipping_profiles }] = await Promise.all([
    api("GET", "/admin/stock-locations?limit=5"),
    api("GET", "/admin/sales-channels?limit=5"),
    api("GET", "/admin/shipping-profiles?limit=5"),
  ])
  const location = stock_locations[0]
  const channel = sales_channels[0]
  const profile = shipping_profiles[0]
  console.log(`склад: ${location.name} | канал: ${channel.name}`)
  console.log(
    PRICE === PLACEHOLDER
      ? "цена: ЗАГЛУШКА 1 ₽, товары заводятся черновиками (в выгрузке склада цен нет)"
      : `цена: ${PRICE} ₽ на все товары`
  )

  if (!STOCK_ONLY) {
    // метки model:NNN — по ним витрина собирает цвета одной модели
    const existingTags = (await all("/admin/product-tags", "product_tags")).reduce((m, t) => {
      m[t.value] = t.id
      return m
    }, {})
    const tagId = {}
    for (const model of [...new Set(catalog.map((p) => p.model))]) {
      const value = "model:" + model
      tagId[model] =
        existingTags[value] ||
        (await api("POST", "/admin/product-tags", { value })).product_tag.id
    }
    console.log(`меток моделей: ${Object.keys(tagId).length}`)

    // уже заведённые адреса — чтобы повторный запуск не создавал дублей
    const done = new Set(
      (await all("/admin/products", "products", "handle")).map((p) => p.handle)
    )

    let создано = 0, пропущено = 0
    for (const p of catalog) {
      if (done.has(p.handle)) { пропущено++; continue }

      const variants = p.variants.map((v) => ({
        title: `${v.size} / ${v.height}`,
        sku: v.sku,
        manage_inventory: true,
        allow_backorder: false,
        options: { "Размер": v.size, "Рост": v.height },
        prices: [{ amount: PRICE, currency_code: "rub" }],
        metadata: { wh_key: v.wh_key, size: v.size, height: v.height },
      }))

      const { product } = await api("POST", "/admin/products", {
        title: p.title,
        handle: p.handle,
        status: "draft",
        shipping_profile_id: profile.id,
        sales_channels: [{ id: channel.id }],
        tags: [{ id: tagId[p.model] }],
        metadata: {
          code: p.code,
          model: p.model,
          article: p.article,
          color: p.color,
          color_hex: p.color_hex,
          fabric: p.fabric,
          cut: p.cut,
          season: p.season,
          source_name: p.source_name,
          ...(PRICE === PLACEHOLDER ? { price_pending: true } : {}),
        },
        options: [
          { title: "Размер", values: p.sizes },
          { title: "Рост", values: p.heights },
        ],
        variants,
      })
      создано++
      if (создано % 10 === 0 || создано === 1) {
        console.log(`  ${создано}/${catalog.length - пропущено}  ${product.title}`)
      }
    }
    console.log(`товары: создано ${создано}, пропущено как уже заведённые ${пропущено}`)
  }

  // ---- остатки ----
  const qty = {}
  for (const p of catalog) for (const v of p.variants) qty[v.sku] = v.qty

  // отдельного эндпоинта остатков в Medusa v2 нет — они лежат внутри
  // позиции учёта, поэтому просим их расширением поля
  const items = await all("/admin/inventory-items", "inventory_items", "id,sku,*location_levels")
  const наши = items.filter((i) => i.sku && qty[i.sku] !== undefined)
  console.log(`позиций учёта: ${items.length}, из них наших: ${наши.length}`)

  const create = [], update = []
  for (const i of наши) {
    const уровень = (i.location_levels ?? []).find((l) => l.location_id === location.id)
    const row = { inventory_item_id: i.id, location_id: location.id, stocked_quantity: qty[i.sku] }
    if (уровень) {
      if (уровень.stocked_quantity !== qty[i.sku]) update.push({ ...row, id: уровень.id })
    } else {
      create.push(row)
    }
  }

  const пачка = 200
  for (const [имя, список] of [["создано", create], ["обновлено", update]]) {
    for (let n = 0; n < список.length; n += пачка) {
      const кусок = список.slice(n, n + пачка)
      await api("POST", "/admin/inventory-items/location-levels/batch",
        имя === "создано" ? { create: кусок } : { update: кусок })
      console.log(`  остатки ${имя}: ${Math.min(n + пачка, список.length)}/${список.length}`)
    }
  }

  const сумма = наши.reduce((s, i) => s + qty[i.sku], 0)
  console.log(`ГОТОВО. Остатков проставлено на ${сумма} шт.`)
}

main().catch((e) => {
  console.error("ОШИБКА:", e.message)
  process.exit(1)
})
