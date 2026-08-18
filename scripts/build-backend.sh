#!/bin/bash
# Сборка бэкенда и установка зависимостей внутрь собранной папки.
# set -e и pipefail обязательны: без них падение npm install остаётся
# незамеченным, а сервис потом не стартует из-за отсутствия исполняемого файла.
set -euo pipefail

cd /home/volento/volento/apps/backend

export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=3072"

npx medusa build

cd .medusa/server
npm install

# без этого файла systemd-сервис не запустится
test -x node_modules/.bin/medusa || { echo "ОШИБКА: medusa не установлена" >&2; exit 1; }

echo "ALL_DONE"
