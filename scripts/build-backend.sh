#!/bin/bash
# Сборка бэкенда и установка зависимостей внутрь собранной папки.
# set -e и pipefail обязательны: без них падение npm install остаётся
# незамеченным, а сервис потом не стартует из-за отсутствия исполняемого файла.
set -euo pipefail

cd /home/volento/volento/apps/backend

export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=3072"

# Русский перевод админки. В самой Medusa он неполный — 1886 строк из 2400,
# остальное показывалось по-английски. Недостающее переведено и лежит в
# apps/backend/i18n/ru.json; кладём файл поверх пакета перед сборкой, потому
# что npm install затирает его при каждой установке зависимостей.
RU_SRC=/home/volento/volento/apps/backend/i18n/ru.json
RU_DST=/home/volento/volento/node_modules/@medusajs/dashboard/src/i18n/translations/ru.json
if [ -f "$RU_SRC" ] && [ -d "$(dirname "$RU_DST")" ]; then
  cp "$RU_SRC" "$RU_DST"
  echo "перевод админки применён"
else
  echo "ВНИМАНИЕ: перевод админки не применён, файл или папка не найдены" >&2
fi

npx medusa build

cd .medusa/server

# Плагин оплаты Точки требует @mikro-orm ровно 6.4.3, а Medusa 2.18 работает
# на 6.6. npm послушно ставил старую версию внутрь собранной папки, и сервер
# поднимался с поломанными связями модулей: корзина не находила оплату,
# доставка — тарифы. Поэтому явно закрепляем ту версию, что стоит у Medusa.
MIKRO=$(node -p "require('/home/volento/volento/node_modules/@mikro-orm/core/package.json').version")
node -e '
const fs = require("fs")
const v = process.argv[1]
const p = "package.json"
const d = JSON.parse(fs.readFileSync(p, "utf8"))
d.overrides = { ...(d.overrides || {}) }
for (const k of ["core", "knex", "postgresql", "migrations", "cli"]) {
  d.overrides["@mikro-orm/" + k] = v
}
fs.writeFileSync(p, JSON.stringify(d, null, 2) + "\n")
console.log("@mikro-orm закреплён на " + v)
' "$MIKRO"

npm install

# без этого файла systemd-сервис не запустится
test -x node_modules/.bin/medusa || { echo "ОШИБКА: medusa не установлена" >&2; exit 1; }

echo "ALL_DONE"
