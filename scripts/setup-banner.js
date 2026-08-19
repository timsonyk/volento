/**
 * Заводит в админке запись «Баннер главной страницы».
 *
 * Идея: Medusa не умеет хранить произвольные картинки сайта, но умеет
 * хранить изображения товара. Поэтому баннер — служебный товар с адресом
 * home-banner и меткой system. Витрина берёт его изображения, а из
 * каталога он спрятан фильтром по этой метке.
 *
 * Первая картинка — для компьютера, вторая — для телефона.
 * Запуск на сервере: node setup-banner.js [путь-к-файлу]
 */
const fs = require("fs")
const path = require("path")

const BASE = "http://127.0.0.1:9000"
const HANDLE = "home-banner"
const SYSTEM_TAG = "system"

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
    throw new Error(`${method} ${endpoint} -> ${res.status} ${JSON.stringify(json).slice(0, 400)}`)
  }
  return json
}

async function upload(filePath) {
  const buffer = fs.readFileSync(filePath)
  const name = path.basename(filePath)
  const ext = path.extname(name).toLowerCase()
  const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg"

  const form = new FormData()
  form.append("files", new Blob([buffer], { type }), name)

  const res = await fetch(BASE + "/admin/uploads", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN },
    body: form,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`загрузка ${name} -> ${res.status} ${JSON.stringify(json).slice(0, 300)}`)
  }
  return json.files[0].url
}

async function main() {
  const file = process.argv[2]

  TOKEN = (
    await api("POST", "/auth/user/emailpass", {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
  ).token

  // метка, по которой витрина прячет служебные записи из каталога
  const { product_tags } = await api("GET", "/admin/product-tags?limit=100")
  let tag = product_tags.find((t) => t.value === SYSTEM_TAG)
  if (!tag) {
    tag = (await api("POST", "/admin/product-tags", { value: SYSTEM_TAG })).product_tag
  }

  const { sales_channels } = await api("GET", "/admin/sales-channels?limit=5")
  const { shipping_profiles } = await api("GET", "/admin/shipping-profiles?limit=5")

  const { products } = await api("GET", `/admin/products?handle=${HANDLE}&limit=1`)
  const existing = products[0]

  const images = []
  if (file) {
    images.push({ url: await upload(file) })
  }

  if (existing) {
    if (images.length) {
      await api("POST", "/admin/products/" + existing.id, { images })
      console.log("баннер обновлён, картинок: " + images.length)
    } else {
      console.log("баннер уже заведён, картинку не меняли")
    }
    console.log("адрес в админке: /app/products/" + existing.id)
    return
  }

  const { product } = await api("POST", "/admin/products", {
    title: "Баннер главной страницы",
    handle: HANDLE,
    status: "published",
    description:
      "Служебная запись. Изображения отсюда показываются баннером на главной странице. Первая картинка — для компьютера, вторая — для телефона. В каталоге не отображается.",
    shipping_profile_id: shipping_profiles[0].id,
    sales_channels: [{ id: sales_channels[0].id }],
    tags: [{ id: tag.id }],
    thumbnail: images[0]?.url,
    images,
    options: [{ title: "Служебный", values: ["—"] }],
    variants: [
      {
        title: "Служебный",
        sku: "SYSTEM-HOME-BANNER",
        manage_inventory: false,
        allow_backorder: false,
        options: { Служебный: "—" },
        prices: [{ amount: 0, currency_code: "rub" }],
      },
    ],
  })

  console.log("баннер заведён, картинок: " + images.length)
  console.log("адрес в админке: /app/products/" + product.id)
  console.log("ГОТОВО")
}

main().catch((e) => {
  console.error("ОШИБКА: " + e.message)
  process.exit(1)
})
