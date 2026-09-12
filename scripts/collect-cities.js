/**
 * Собирает список городов из пунктов выдачи ApiShip.
 *
 * Своего справочника городов у ApiShip нет — только по отдельным службам,
 * и Яндекса среди них нет. Зато можно пройти по самим пунктам: получится
 * список тех городов, куда реально возят, а не вообще всех в стране.
 *
 * Запускать редко, при добавлении новой службы доставки.
 */
const BASE = "http://127.0.0.1:9000"
const ПОРЦИЯ = 5000
let TOKEN = ""

const апи = async (путь) =>
  (await fetch(BASE + путь, { headers: { Authorization: "Bearer " + TOKEN } })).json()

async function main() {
  TOKEN = (
    await (
      await fetch(BASE + "/auth/user/emailpass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
      })
    ).json()
  ).token

  const города = new Map()
  let offset = 0

  for (;;) {
    const q = new URLSearchParams({
      provider_id: "int_apiship_apiship-1",
      fields: "city,region",
      limit: String(ПОРЦИЯ),
      offset: String(offset),
    })
    const j = await апи("/admin/apiship/points?" + q)
    const пункты = j.points ?? []

    for (const п of пункты) {
      const город = (п.city ?? "").trim()
      if (!город) continue
      const ключ = город.toLowerCase()
      const прежний = города.get(ключ)
      const запись = { город, регион: (п.region ?? "").trim(), пунктов: (прежний?.пунктов ?? 0) + 1 }
      города.set(ключ, запись)
    }

    process.stderr.write(`выгружено ${offset + пункты.length}, городов ${города.size}\n`)
    if (пункты.length < ПОРЦИЯ) break
    offset += ПОРЦИЯ
  }

  // Сортируем по числу пунктов: в подсказках сверху окажутся крупные города
  const список = [...города.values()]
    .sort((a, b) => b.пунктов - a.пунктов)
    .map(({ город, регион }) => (регион && регион !== город ? [город, регион] : [город]))

  console.log(JSON.stringify(список))
}

main().catch((e) => { console.error("ОШИБКА: " + e.message); process.exit(1) })
