/**
 * Проверяет ровно то, что ломалось: связи корзины с доставкой и оплатой.
 * Создаёт корзину, кладёт товар, ставит адрес и спрашивает варианты
 * доставки и способы оплаты.
 */
const BASE = "http://127.0.0.1:9000"
const KEY = process.env.MEDUSA_PUBLISHABLE_KEY

const store = async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": KEY,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(j).slice(0, 200)}`)
  return j
}

async function main() {
  // регионов несколько, цены заведены только в рублях: берём российский,
  // иначе цена приходит пустой и корзина падает на подсчёте суммы
  const { regions } = await store("GET", "/store/regions")
  const region = regions.find((r) => r.currency_code === "rub") ?? regions[0]
  console.log("регион: " + region.name + " / " + region.currency_code)

  // цены обязательно: без них корзина падает на подсчёте суммы.
  // служебные записи (баннер главной) пропускаем — это не товар
  const { products } = await store(
    "GET",
    `/store/products?limit=20&region_id=${region.id}&fields=*variants.calculated_price,+tags`
  )
  const товар = products.find(
    (p) =>
      !p.tags?.some((t) => t.value === "system") &&
      (p.variants ?? []).some((v) => v.calculated_price)
  )
  if (!товар) throw new Error("не нашёл товара с ценой")
  const variant = товар.variants.find((v) => v.calculated_price)
  console.log("проверяю на товаре: " + товар.title)

  const { cart } = await store("POST", "/store/carts", { region_id: region.id })
  await store("POST", `/store/carts/${cart.id}/line-items`, {
    variant_id: variant.id,
    quantity: 1,
  })
  await store("POST", `/store/carts/${cart.id}`, {
    email: "proverka@volento.com",
    shipping_address: {
      first_name: "Проверка",
      last_name: "Связей",
      address_1: "ул. Тестовая, 1",
      city: "Москва",
      country_code: region.countries[0].iso_2,
      postal_code: "101000",
      phone: "+79000000000",
    },
  })

  const { shipping_options } = await store(
    "GET",
    `/store/shipping-options?cart_id=${cart.id}`
  )
  console.log("варианты доставки: " + shipping_options.length +
    (shipping_options.length ? " — " + shipping_options.map((o) => o.name).join(", ") : ""))

  const { payment_providers } = await store(
    "GET",
    `/store/payment-providers?region_id=${region.id}`
  )
  console.log("способы оплаты: " + payment_providers.length +
    (payment_providers.length ? " — " + payment_providers.map((p) => p.id).join(", ") : ""))

  const { payment_collection } = await store("POST", "/store/payment-collections", {
    cart_id: cart.id,
  })
  console.log("платёжная запись создана: " + (payment_collection?.id ? "да" : "нет"))

  console.log("СВЯЗИ РАБОТАЮТ")
}

main().catch((e) => {
  console.error("НЕ ПРОШЛО: " + e.message)
  process.exit(1)
})
