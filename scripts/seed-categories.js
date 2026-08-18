/**
 * Разделы каталога по силуэту. Нужны, чтобы меню и плитки на главной
 * работали на настоящих данных, а не на заглушках.
 * Запуск на сервере: node seed-categories.js
 */
const BASE = "http://127.0.0.1:9000"

const CATEGORIES = [
  { name: "Прямые", handle: "pryamye", match: "прямые" },
  { name: "Зауженные", handle: "zauzhennye", match: "зауженные" },
  { name: "Широкие", handle: "shirokie", match: "широкие" },
]

let TOKEN = ""

async function api(method, endpoint, body) {
  const res = await fetch(BASE + endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`${method} ${endpoint} -> ${res.status} ${JSON.stringify(json).slice(0, 300)}`)
  }
  return json
}

async function main() {
  TOKEN = (
    await api("POST", "/auth/user/emailpass", {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
  ).token

  const { product_categories: existing } = await api("GET", "/admin/product-categories?limit=50")
  for (const c of existing) {
    await api("DELETE", "/admin/product-categories/" + c.id)
  }

  const { products } = await api("GET", "/admin/products?limit=100")

  for (const cat of CATEGORIES) {
    const { product_category } = await api("POST", "/admin/product-categories", {
      name: cat.name,
      handle: cat.handle,
      is_active: true,
      is_internal: false,
    })

    const ids = products
      .filter((p) => p.title.toLowerCase().includes(cat.match))
      .map((p) => p.id)

    if (ids.length) {
      await api("POST", `/admin/product-categories/${product_category.id}/products`, {
        add: ids,
      })
    }
    console.log(`раздел "${cat.name}": товаров ${ids.length}`)
  }
  console.log("ГОТОВО")
}

main().catch((e) => {
  console.error("ОШИБКА: " + e.message)
  process.exit(1)
})
