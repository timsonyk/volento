/**
 * Собирает список городов из пунктов выдачи ApiShip.
 *
 * Своего справочника городов у ApiShip нет — только по отдельным службам,
 * и Яндекса среди них нет. Зато можно пройти по самим пунктам: получится
 * список тех городов, куда реально возят, а не вообще всех в стране.
 *
 * Заодно пишет координаты всех пунктов (файл из первого аргумента): по ним
 * посёлку без пунктов выдачи подбирается город с ближайшим пунктом
 * (apps/storefront/src/lib/data/poselki.ts).
 *
 * Запускать редко, при добавлении новой службы доставки:
 *   node collect-cities.js punkty-vydachi.json > cities.json
 */
const fs = require("fs")

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
  const точки = []
  let offset = 0

  for (;;) {
    const q = new URLSearchParams({
      provider_id: "int_apiship_apiship-1",
      fields: "city,region,lat,lng",
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
      const ш = Number(п.lat), д = Number(п.lng)
      if (ш && д) точки.push([+ш.toFixed(4), +д.toFixed(4), ключ])
    }

    process.stderr.write(`выгружено ${offset + пункты.length}, городов ${города.size}\n`)
    if (пункты.length < ПОРЦИЯ) break
    offset += ПОРЦИЯ
  }

  // Сортируем по числу пунктов: в подсказках сверху окажутся крупные города
  const по_числу = [...города.entries()].sort((a, b) => b[1].пунктов - a[1].пунктов)
  const список = по_числу.map(([, { город, регион }]) =>
    регион && регион !== город ? [город, регион] : [город]
  )
  console.log(JSON.stringify(список))

  // Пункт хранит номер своего города в списке выше
  const номер = new Map(по_числу.map(([ключ], и) => [ключ, и]))
  fs.writeFileSync(
    process.argv[2],
    JSON.stringify({
      goroda: по_числу.map(([, { город }]) => город),
      punkty: точки.map(([ш, д, ключ]) => [ш, д, номер.get(ключ)]),
    })
  )
}

main().catch((e) => { console.error("ОШИБКА: " + e.message); process.exit(1) })
