/**
 * Пересоздаёт тестовый каталог по структуре «цвет = отдельный товар».
 *
 * Товар   = модель + цвет, у него свой артикул и своя съёмка.
 * Вариант = размер + рост, SKU = артикул-размер-рост.
 * Связь   = метка model:<КОД МОДЕЛИ> плюс поля model / article / color /
 *           color_hex, по ним витрина собирает остальные цвета модели.
 *
 * Фотографии берутся из PHOTO_DIR и загружаются в бэкенд.
 * Запуск на сервере: node seed-test-catalog.js
 */

const fs = require("fs")
const path = require("path")

const BASE = "http://127.0.0.1:9000"
const PHOTO_DIR = process.env.PHOTO_DIR || "/root/photos"

const SIZES = ["44", "46", "48"]
const HEIGHTS = ["164", "170"]

const MODELS = [
  {
    model: "VLT-001",
    shape: "Брюки классические прямые",
    price: 5900,
    colors: [
      {
        article: "VLT-001-BLK",
        name: "Чёрный",
        hex: "#1a1a1a",
        handle: "bryuki-pryamye-chernye",
        photos: ["MP002XW0NQWI_20630347_2_v3_2x.webp", "MP002XW0PP6E_22451070_2_v2_2x.webp"],
      },
      {
        article: "VLT-001-MLK",
        name: "Молочный",
        hex: "#f0ece4",
        handle: "bryuki-pryamye-molochnye",
        photos: ["MP002XW0VDOS_30748795_2_v2_2x.webp"],
      },
      {
        article: "VLT-001-BRN",
        name: "Коричневый",
        hex: "#5a4636",
        handle: "bryuki-pryamye-korichnevye",
        photos: ["MP002XW187KK_24468142_2_v4_2x.webp"],
      },
    ],
  },
  {
    model: "VLT-002",
    shape: "Брюки классические зауженные",
    price: 6500,
    colors: [
      {
        article: "VLT-002-NVY",
        name: "Тёмно-синий",
        hex: "#2c3a52",
        handle: "bryuki-zauzhennye-temno-sinie",
        photos: ["MP002XW0XD6D_27190839_2_v2_2x.webp"],
      },
      {
        article: "VLT-002-BLK",
        name: "Чёрный",
        hex: "#1a1a1a",
        handle: "bryuki-zauzhennye-chernye",
        photos: ["MP002XW177JS_24014404_2_v1.webp"],
      },
    ],
  },
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
    throw new Error(`${method} ${endpoint} -> ${res.status} ${JSON.stringify(json).slice(0, 400)}`)
  }
  return json
}

async function uploadPhoto(fileName) {
  const filePath = path.join(PHOTO_DIR, fileName)
  const buffer = fs.readFileSync(filePath)

  const form = new FormData()
  form.append("files", new Blob([buffer], { type: "image/webp" }), fileName)

  const res = await fetch(BASE + "/admin/uploads", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN },
    body: form,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`загрузка ${fileName} -> ${res.status} ${JSON.stringify(json).slice(0, 300)}`)
  }
  return json.files[0].url
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
    const { product_tag: tag } = await api("POST", "/admin/product-tags", {
      value: "model:" + m.model,
    })

    for (const c of m.colors) {
      const urls = []
      for (const photo of c.photos) {
        urls.push(await uploadPhoto(photo))
      }

      const { product } = await api("POST", "/admin/products", {
        title: `${m.shape}, ${c.name.toLowerCase()}`,
        handle: c.handle,
        status: "published",
        description: `Женские классические брюки. Артикул ${c.article}.`,
        shipping_profile_id: profile.id,
        sales_channels: [{ id: channel.id }],
        tags: [{ id: tag.id }],
        thumbnail: urls[0],
        images: urls.map((url) => ({ url })),
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
      console.log(
        `создан: ${product.title} (${c.article}, вариантов ${product.variants.length}, фото ${urls.length})`
      )
    }
  }

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
