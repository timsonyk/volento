#!/bin/bash
# Быстрая проверка магазина: товар -> корзина -> сумма.
# Запускать на сервере от root (нужен доступ к /root/.volento-secrets).
set -euo pipefail

. /root/.volento-secrets
export PGPASSWORD="$DB_PASSWORD"
PK=$(psql -h 127.0.0.1 -U volento -d volento -tAc \
  "SELECT token FROM api_key WHERE type='publishable' LIMIT 1;")

BASE=http://127.0.0.1:9000
export PK BASE

node <<'JS'
const BASE = process.env.BASE
const PK = process.env.PK

async function store(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", "x-publishable-api-key": PK },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json).slice(0, 300)}`)
  }
  return json
}

async function main() {
  const { regions } = await store("GET", "/store/regions")
  const ru = regions.find((r) => r.currency_code === "rub")
  console.log(`регион: ${ru.name} / ${ru.currency_code}`)

  const { products } = await store(
    "GET",
    `/store/products?region_id=${ru.id}&fields=*variants.calculated_price`
  )
  console.log(`товаров на витрине: ${products.length}`)

  const variant = products[0].variants[0]
  console.log(`выбран вариант: ${variant.sku}`)

  const { cart: created } = await store("POST", "/store/carts", { region_id: ru.id })
  await store("POST", `/store/carts/${created.id}/line-items`, {
    variant_id: variant.id,
    quantity: 2,
  })
  const { cart } = await store("GET", `/store/carts/${created.id}`)

  console.log(`позиций в корзине: ${cart.items.length}`)
  console.log(`итого: ${cart.total} ${cart.currency_code}`)

  if (cart.items.length !== 1 || cart.total <= 0) {
    console.error("ПРОВЕРКА НЕ ПРОЙДЕНА")
    process.exit(1)
  }
  console.log("ПРОВЕРКА ПРОЙДЕНА")
}

main().catch((e) => {
  console.error("ОШИБКА: " + e.message)
  process.exit(1)
})
JS
