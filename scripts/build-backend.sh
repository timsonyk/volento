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

# Заплатка к плагину ApiShip 2.0.0-beta.5.
#
# В его админке список «Пункт приёма заказов» запрашивается без фильтра по
# городу (в исходниках фильтр закомментирован), а на сервере стоит предел в
# 50 записей. В итоге ApiShip отдаёт полсотни случайных точек по всей стране
# и в выпадающем списке видно Тверь и Йошкар-Олу, а московских — четыре
# штуки. Дописываем город прямо в запрос.
#
# Город берётся из APISHIP_CITY, по умолчанию Москва. Заплатка временная:
# при обновлении плагина строка изменится и правка перестанет применяться —
# сборка об этом скажет, но не упадёт.
# Имена переменных здесь латиницей не для красоты: bash не умеет
# кириллические имена и падает на них с «command not found».
CITY=${APISHIP_CITY:-Москва}
PLUGIN_ADMIN=/home/volento/volento/node_modules/@gorgo/medusa-fulfillment-apiship/.medusa/server/src/admin
OLD='availableOperation=[1,3];providerKey=${providerKey}`'
NEW="availableOperation=[1,3];providerKey=\${providerKey};city=$CITY\`"
PATCHED=0
for f in "$PLUGIN_ADMIN/index.js" "$PLUGIN_ADMIN/index.mjs"; do
  if [ -f "$f" ] && grep -qF "$OLD" "$f"; then
    OLD="$OLD" NEW="$NEW" FILE="$f" python3 - <<'PYEOF'
import os
путь = os.environ["FILE"]
s = open(путь, encoding="utf-8").read()
open(путь, "w", encoding="utf-8").write(s.replace(os.environ["OLD"], os.environ["NEW"]))
PYEOF
    PATCHED=$((PATCHED + 1))
  fi
done
if [ "$PATCHED" -gt 0 ]; then
  echo "ApiShip: список пунктов приёма ограничен городом $CITY"
else
  echo "ВНИМАНИЕ: заплатка ApiShip не применилась — проверьте, не починили ли её в плагине" >&2
fi


# Заплатка вторая: расчёт доставки считает заказ одной коробкой.
#
# В плагине две функции. Та, что собирает накладную, складывает вещи в одно
# место: вес суммирует, толщину складывает стопкой, длину и ширину берёт
# максимальные. Та, что считает цену для витрины, перечисляет вещи по одной
# и отправляет в ApiShip столько мест, сколько вещей в корзине.
#
# Перевозчик берёт за место: восемь пар брюк считались как восемь посылок и
# стоили около 800 рублей вместо 322 за одну коробку. При этом поедет всё
# равно одна коробка — накладная-то собрана верно. Покупателю показывалась
# цена вдвое-втрое выше настоящей.
#
# Применяем в расчёте то же правило, что у них в накладной; оно же описано
# в документации ApiShip (складывать наименьшие стороны, брать максимум из
# остальных двух).
#
# Заплатка временная — авторам написано. Если в новой версии код изменится,
# правка не применится, сборка скажет об этом и продолжится.
MAPPING=/home/volento/volento/node_modules/@gorgo/medusa-fulfillment-apiship/.medusa/server/src/providers/fulfillment-apiship/utils/mapping.js
if [ -f "$MAPPING" ]; then
  FILE="$MAPPING" python3 - <<'PYEOF' || echo "ВНИМАНИЕ: заплатка «одна коробка» не применилась — проверьте плагин" >&2
import os
import sys

путь = os.environ["FILE"]
s = open(путь, encoding="utf-8").read()

НАЧАЛО = "const places = items.flatMap((item) => {"
if "__одна_коробка" in s:
    print("ApiShip: расчёт уже считает заказ одной коробкой")
    sys.exit(0)
if НАЧАЛО not in s:
    sys.exit(1)

i = s.index(НАЧАЛО)
# конец блока — ближайшее закрытие flatMap на том же уровне отступа
к = s.index("\n    });", i)
конец = к + len("\n    });")

замена = """const __одна_коробка = items.flatMap((item) => {
        const weight = item.variant?.weight ?? apishipOptions.default_product_weight;
        const height = item.variant?.height ?? apishipOptions.default_product_height;
        const length = item.variant?.length ?? apishipOptions.default_product_length;
        const width = item.variant?.width ?? apishipOptions.default_product_width;
        return Array.from({ length: item.quantity }, () => ({ height, length, width, weight }));
    });
    const __стороны = __одна_коробка.map((e) => [e.height, e.width, e.length].sort((a, b) => a - b));
    const places = __одна_коробка.length === 0 ? [] : [{
        height: __стороны.reduce((s, d) => s + d[0], 0),
        length: Math.max(...__стороны.map((d) => d[1])),
        width: Math.max(...__стороны.map((d) => d[2])),
        weight: __одна_коробка.reduce((s, e) => s + e.weight, 0),
    }];"""

open(путь, "w", encoding="utf-8").write(s[:i] + замена + s[конец:])
print("ApiShip: расчёт теперь считает заказ одной коробкой")
PYEOF
else
  echo "ВНИМАНИЕ: файл расчёта ApiShip не найден" >&2
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
