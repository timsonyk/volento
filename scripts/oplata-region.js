/**
 * Способы оплаты в рублёвом регионе: оставляет только Точку.
 *
 * «Оплата вручную» (pp_system_default) — заглушка Medusa для разработки:
 * заказ оформляется без денег. На живом сайте её быть не должно.
 *
 * Запуск на сервере (логин админки берётся из /root/.volento-secrets):
 *   set -a; . /root/.volento-secrets; set +a; node scripts/oplata-region.js
 *   ... node scripts/oplata-region.js --proverka   — только показать, ничего не менять
 */
const BASE = "http://127.0.0.1:9000"
const ТОЧКА = "pp_tochka_tochka"
const только_показать = process.argv.includes("--proverka")

let token = ""

const api = async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(j).slice(0, 300)}`)
  return j
}

async function main() {
  token = (
    await api("POST", "/auth/user/emailpass", {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
  ).token

  const { payment_providers } = await api("GET", "/admin/payments/payment-providers?limit=50")
  const есть = payment_providers.map((p) => p.id)
  console.log("подключены к Medusa: " + есть.join(", "))

  if (!есть.includes(ТОЧКА)) {
    throw new Error(`${ТОЧКА} нет среди способов оплаты — не задан TOCHKA_JWT_TOKEN или сервер не перезапущен`)
  }

  const { regions } = await api("GET", "/admin/regions?fields=id,name,currency_code,*payment_providers&limit=50")
  const регион = regions.find((r) => r.currency_code === "rub")
  if (!регион) throw new Error("рублёвого региона нет")

  const было = (регион.payment_providers ?? []).map((p) => p.id)
  console.log(`регион «${регион.name}» сейчас: ${было.join(", ") || "пусто"}`)

  if (только_показать) return

  await api("POST", `/admin/regions/${регион.id}`, { payment_providers: [ТОЧКА] })

  const { region } = await api("GET", `/admin/regions/${регион.id}?fields=*payment_providers`)
  console.log(`регион «${регион.name}» теперь: ${region.payment_providers.map((p) => p.id).join(", ")}`)
}

main().catch((e) => {
  console.error("ОШИБКА: " + e.message)
  process.exit(1)
})
