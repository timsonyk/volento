/**
 * Пересоздаёт тестовый каталог по структуре «цвет = отдельный товар».
 *
 * Товар      = модель + цвет, у него свой артикул.
 * Вариант    = размер + рост, SKU = артикул-размер-рост.
 * Связь      = метка model:<КОД МОДЕЛИ> плюс поля model / color / color_hex,
 *              по ним витрина находит остальные цвета той же модели.
 *
 * Запускать на сервере от root: node seed-test-catalog.js
 */

const BASE = "http://127.0.0.1:9000"

const SIZES = ["44", "46", "48"]
const HEIGHTS = ["164", "170"]

const MODELS = [
  {
    model: "VLT-001",
    shape: "Брюки классические прямые",
    price: 5900,
    colors: [
      { article: "VLT-001-BLK", name: "Чёрный", hex: "#1a1a1a", handle: "bryuki-pryamye-chernye" },
      { article: "VLT-001-BEI", name: "Бежевый", hex: "#c8b39a", handle: "bryuki-pryamye-bezhevye" },
    ],
  },
  {
    model: "VLT-002",
    shape: "Брюки классические зауженные",
    price: 6500,
    colors: [
      { article: "VLT-002-BLK", name: "Чёрный", hex: "#1a1a1a", handle: "bryuki-zauzhennye-chernye" },
      { article: "VLT-002-GRY", name: "Серый", hex: "#8c8c8c", handle: "bryuki-zauzhennye-serye" },
    ],
  },
]

let TOKEN = ""

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json).slice(0, 400)}`)
  }
  return json
}

function buildVariants(article, price) {
  const variants = []
  for (const size of SIZES) {
    for (const height of HEIGHTS) {
      variants.push({
        title: `${size} / ${height}`,
        sku: `${article}-${size}-${height}`,
        manage_inventory: true,
        allow_backorder: false,
        options: { Размер: size, Рост: height },
        prices: [{ amount: price, currency_code: "rub" }],
      })
    }
  }
  return variants
}

async function main() {
  TOKEN = (
    await api("POST", "/auth/user/emailpass", {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
  ).token

  // чистим прошлые тестовые товары и метки моделей
  const { products: existing } = await api("GET", "/admin/products?limit=100")
  for (const p of existing) {
    await api("DELETE", "/admin/products/" + p.id)
    console.log("удалён: " + p.title)
  }
  const { product_tags: oldTags } = await api("GET", "/admin/product-tags?limit=100")
  for (const t of oldTags.filter((t) => t.value.startsWith("model:"))) {
    await api("DELETE", "/admin/product-tags/" + t.id)
  }

  const [{ stock_locations }, { sales_channels }, { shipping_profiles }] = await Promise.all([
    api("GET", "/admin/stock-locations?limit=5"),
    api("GET", "/admin/sales-channels?limit=5"),
    api("GET", "/admin/shipping-profiles?limit=5"),
  ])
  const location = stock_locations[0]
  const channel = sales_channels[0]
  const profile = shipping_profiles[0]

  for (const m of MODELS) {
    // одна метка на модель — по ней витрина соберёт все цвета
    const { product_tag: tag } = await api("POST", "/admin/product-tags", {
      value: "model:" + m.model,
    })

    for (const c of m.colors) {
      const { product } = await api("POST", "/admin/products", {
        title: `${m.shape}, ${c.name.toLowerCase()}`,
        handle: c.handle,
        status: "published",
        description: `Женские классические брюки. Артикул ${c.article}.`,
        shipping_profile_id: profile.id,
        sales_channels: [{ id: channel.id }],
        tags: [{ id: tag.id }],
        metadata: {
          model: m.model,
          article: c.article,
          color: c.name,
          color_hex: c.hex,
        },
        options: [
          { title: "Размер", values: SIZES },
          { title: "Рост", values: HEIGHTS },
        ],
        variants: buildVariants(c.article, m.price),
      })
      console.log(`создан: ${product.title} (${c.article}, вариантов ${product.variants.length})`)
    }
  }

  // остатки на уровне варианта
  const { inventory_items } = await api("GET", "/admin/inventory-items?limit=200")
  let n = 0
  for (const item of inventory_items) {
    if (!item.sku) continue
    await api("POST", `/admin/inventory-items/${item.id}/location-levels`, {
      location_id: location.id,
      stocked_quantity: 10,
    })
    n++
  }
  console.log(`остатки проставлены: ${n} вариантов по 10 шт.`)
  console.log("ГОТОВО")
}

main().catch((e) => {
  console.error("ОШИБКА: " + e.message)
  process.exit(1)
})
