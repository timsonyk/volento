/**
 * Скрытый товар «Проверка оплаты» за 10 ₽ — для живых платежей до
 * открытия магазина.
 *
 * Метка system прячет его из каталога, поиска и главной (как баннер
 * главной), но страница по прямой ссылке открывается:
 *   https://slytn.ru/ru/products/proverka-oplaty
 * Остатков не ведёт (manage_inventory: false) — склад о нём не знает.
 *
 * Перед открытием магазина удалить: node scripts/tovar-proverka.js --udalit
 *
 * Запуск на сервере:
 *   set -a; . /root/.volento-secrets; set +a; node scripts/tovar-proverka.js
 */
const BASE = "http://127.0.0.1:9000"
const HANDLE = "proverka-oplaty"
const СЛУЖЕБНАЯ = "system"
const удалить = process.argv.includes("--udalit")

let token = ""
const api = async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(j).slice(0, 300)}`)
  return j
}

async function main() {
  token = (await api("POST", "/auth/user/emailpass", {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  })).token

  const { products } = await api("GET", `/admin/products?handle=${HANDLE}&fields=id,status`)
  const есть = products[0]

  if (удалить) {
    if (!есть) return console.log("товара и так нет")
    await api("DELETE", `/admin/products/${есть.id}`)
    return console.log("товар удалён")
  }

  if (есть) {
    console.log("товар уже есть: https://slytn.ru/ru/products/" + HANDLE)
    return
  }

  const { product_tags } = await api("GET", "/admin/product-tags?limit=100")
  let tag = product_tags.find((t) => t.value === СЛУЖЕБНАЯ)
  if (!tag) tag = (await api("POST", "/admin/product-tags", { value: СЛУЖЕБНАЯ })).product_tag

  const { sales_channels } = await api("GET", "/admin/sales-channels?limit=5")
  const { shipping_profiles } = await api("GET", "/admin/shipping-profiles?limit=5")

  // Фото берём у любого опубликованного товара: без картинки карточка
  // выглядит сломанной, а загружать отдельную ради проверки незачем.
  const { products: образцы } = await api("GET", "/admin/products?status[]=published&limit=5&fields=thumbnail")
  const фото = образцы.find((п) => п.thumbnail)?.thumbnail

  const { product } = await api("POST", "/admin/products", {
    title: "Проверка оплаты",
    handle: HANDLE,
    status: "published",
    description: "Служебный товар для проверки оплаты до открытия магазина. Не продаётся.",
    shipping_profile_id: shipping_profiles[0].id,
    sales_channels: [{ id: sales_channels[0].id }],
    tags: [{ id: tag.id }],
    ...(фото ? { thumbnail: фото, images: [{ url: фото }] } : {}),
    options: [{ title: "Размер", values: ["Один"] }],
    variants: [{
      title: "Один",
      sku: "SYSTEM-PROVERKA-OPLATY",
      manage_inventory: false,
      allow_backorder: false,
      options: { Размер: "Один" },
      prices: [{ amount: 10, currency_code: "rub" }],
    }],
  })

  console.log("товар заведён: https://slytn.ru/ru/products/" + HANDLE)
  console.log("в админке: /app/products/" + product.id)
}

main().catch((e) => { console.error("ОШИБКА: " + e.message); process.exit(1) })
