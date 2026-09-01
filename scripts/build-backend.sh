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
npm install

# без этого файла systemd-сервис не запустится
test -x node_modules/.bin/medusa || { echo "ОШИБКА: medusa не установлена" >&2; exit 1; }

echo "ALL_DONE"
