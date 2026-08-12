#!/bin/bash
# Полная пересборка витрины: зависимости с нуля, затем сборка.
# Запускать от пользователя volento. Ограничение памяти обязательно:
# на 2 ГБ сборка Next.js без него падает, работает за счёт swap.
set -euo pipefail

cd /home/volento/volento/apps/storefront

rm -rf node_modules .next
npm install

export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=3072"
npm run build

echo "ALL_DONE"
