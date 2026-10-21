#!/bin/bash
# Проверка правила «заказ только от вошедшего» на живом бэкенде.
# Запускать на сервере от root:
#   scp scripts/vhod-proverka.sh volento:/root/ && ssh volento bash /root/vhod-proverka.sh
#
# Ничего не оплачивает и не оформляет: гостю должны отказать раньше, а у
# вошедшего оформление падает дальше — на отсутствии оплаты. Корзины
# создаются, как у обычного посетителя. Письма не уходят: вход — через
# ключ автотестов (E2E_KLYUCH) на адрес @example.com.
set -u
B=${B:-http://127.0.0.1:9000}
E=/home/volento/volento/apps/backend/.env
PK=$(grep '^NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=' /home/volento/volento/apps/storefront/.env.local | cut -d= -f2-)
VK=$(grep '^VITRINA_KLYUCH=' $E | cut -d= -f2-)
EK=$(grep '^E2E_KLYUCH=' $E | cut -d= -f2-)
set -a; . /root/.volento-secrets; set +a
OK=0; BAD=0
H=(-H "x-publishable-api-key: $PK" -H "Content-Type: application/json")

check() {
  local name=$1 want=$2 got=$3
  if [[ "$got" =~ ^($want)$ ]]; then OK=$((OK+1)); echo "OK   $name ($got)"; else BAD=$((BAD+1)); echo "FAIL $name: код $got, ждали $want; $(head -c 200 /tmp/vh.out)"; fi
}
post() { curl -s -o /tmp/vh.out -w "%{http_code}" -X POST "$B$1" "${H[@]}" "${@:3}" ${2:+-d "$2"}; }

REG=$(curl -s "$B/store/regions" "${H[@]}" | jq -r '.regions[0].id')

echo "== Вход покупателя"
c=$(post /auth/customer/emailpass/register "{\"email\":\"e2e-pass-$RANDOM@example.com\",\"password\":\"Qwerty12345\"}")
check "регистрация покупателя по паролю закрыта" "40[0-9]" "$c"
c=$(post /auth/user/emailpass "$(jq -nc --arg e "$ADMIN_EMAIL" --arg p "$ADMIN_PASSWORD" '{email:$e,password:$p}')")
check "админка по-прежнему входит по паролю" 200 "$c"
c=$(post /store/vhod "{\"email\":\"e2e-bezklyucha-$RANDOM@example.com\"}" -H "x-e2e-klyuch: neverno")
check "чужой ключ автотестов — кода в ответе нет" 200 "$c"
jq -e 'has("код")|not' /tmp/vh.out >/dev/null && { OK=$((OK+1)); echo "OK   код не отдан"; } || { BAD=$((BAD+1)); echo "FAIL код отдан без ключа"; }

echo "== Гость"
G=$(curl -s -X POST "$B/store/carts" "${H[@]}" -d "{\"region_id\":\"$REG\",\"email\":\"e2e-gost-$RANDOM@example.com\"}" | jq -r .cart.id)
c=$(post /store/oplata/tochka "{\"cart_id\":\"$G\"}" -H "x-vitrina-klyuch: $VK")
check "гость: ссылка на оплату — 401" 401 "$c"
grep -q "войдите" /tmp/vh.out && { OK=$((OK+1)); echo "OK   понятный текст ошибки"; } || { BAD=$((BAD+1)); echo "FAIL текст: $(cat /tmp/vh.out)"; }
c=$(post /store/carts/$G/complete "" -H "x-vitrina-klyuch: $VK")
check "гость: оформление корзины — 401" 401 "$c"
PC=$(curl -s -X POST "$B/store/payment-collections" "${H[@]}" -d "{\"cart_id\":\"$G\"}" | jq -r '.payment_collection.id')
c=$(post /store/payment-collections/$PC/payment-sessions '{"provider_id":"pp_tochka_tochka"}' -H "x-vitrina-klyuch: $VK")
check "гость: сессия оплаты — 401" 401 "$c"

echo "== Вошедший"
P="e2e-vhod-$RANDOM$RANDOM@example.com"
KOD=$(curl -s -X POST "$B/store/vhod" "${H[@]}" -H "x-e2e-klyuch: $EK" -d "{\"email\":\"$P\"}" | jq -r '.["код"]')
[ "$KOD" != null ] && [ -n "$KOD" ] && { OK=$((OK+1)); echo "OK   код для автотеста выдан"; } || { BAD=$((BAD+1)); echo "FAIL код не выдан"; }
T=$(curl -s -X POST "$B/auth/customer/kod" "${H[@]}" -d "{\"email\":\"$P\",\"code\":\"$KOD\"}" | jq -r .token)
c=$(post /store/customers "{\"email\":\"$P\",\"first_name\":\"Анна\",\"last_name\":\"Тестова\",\"phone\":\"+7 900 000-00-00\"}" -H "authorization: Bearer $T")
check "покупатель заведён" 200 "$c"
T=$(curl -s -X POST "$B/auth/token/refresh" "${H[@]}" -H "authorization: Bearer $T" | jq -r .token)
c=$(post /auth/customer/kod "{\"email\":\"$P\",\"code\":\"000000\"}")
check "неверный код не пускает" "40[0-9]" "$c"
K=$(curl -s -X POST "$B/store/carts" "${H[@]}" -H "authorization: Bearer $T" -d "{\"region_id\":\"$REG\"}" | jq -r .cart.id)
c=$(post /store/carts/$K/complete "" -H "x-vitrina-klyuch: $VK")
[ "$c" != 401 ] && { OK=$((OK+1)); echo "OK   вошедший: правило входа пропускает (дальше $c — нет оплаты)"; } || { BAD=$((BAD+1)); echo "FAIL вошедшему отказали: $(cat /tmp/vh.out)"; }
c=$(post /store/carts/$G/customer "" -H "authorization: Bearer $T")
check "гостевую корзину можно забрать после входа" 200 "$c"
c=$(post /store/carts/$G/complete "" -H "x-vitrina-klyuch: $VK")
[ "$c" != 401 ] && { OK=$((OK+1)); echo "OK   забранная корзина проходит правило ($c)"; } || { BAD=$((BAD+1)); echo "FAIL забранной корзине отказали"; }

echo "== Возврат через кабинет: только свой заказ"
SK=$(grep '^SKLAD_KEY=' $E | cut -d= -f2-)
S=(-H "X-Sklad-Key: $SK" -H "Content-Type: application/json")
N=$(curl -s -X POST "$B/sklad/proba/zakaz" "${S[@]}" -d "{\"kolichestva\":[2],\"pochta\":\"$P\"}" | jq -r .nomer)
Z=$(curl -s "$B/sklad/zadaniya?test=1" "${S[@]}" | jq -c --arg n "$N" '.zadaniya[]|select(.nomer==$n)')
ID=$(jq -r .id <<<"$Z"); SID=$(jq -r '.pozicii[0].id_stroki' <<<"$Z")
curl -s -X POST "$B/sklad/zadaniya/$N/sborka" "${S[@]}" -d "{\"pozicii\":[{\"id_stroki\":\"$SID\",\"kolichestvo\":2,\"kody\":[\"0104601234567890215vh1$N\u001d93x\",\"0104601234567890215vh2$N\u001d93x\"]}]}" >/dev/null
curl -s "$B/sklad/k-upakovke?test=1" "${S[@]}" >/dev/null
curl -s -X POST "$B/sklad/zadaniya/$N/upakovano" "${S[@]}" >/dev/null
curl -s -X POST "$B/sklad/proba/vydacha/$N" "${S[@]}" >/dev/null
c=$(curl -s -o /tmp/vh.out -w "%{http_code}" "$B/store/vozvrat/$ID" "${H[@]}")
check "без входа — 401" 401 "$c"
c=$(curl -s -o /tmp/vh.out -w "%{http_code}" "$B/store/vozvrat/$ID" "${H[@]}" -H "authorization: Bearer $T")
check "свой заказ: можно вернуть 2 пары" 200 "$c"
jq -e '(.pary|length)==2 and .do!=null and (.prichiny|length)>3' /tmp/vh.out >/dev/null && { OK=$((OK+1)); echo "OK   пары, срок и причины"; } || { BAD=$((BAD+1)); echo "FAIL ответ: $(head -c 300 /tmp/vh.out)"; }
KOD=$(jq -r '.pary[0].kod' /tmp/vh.out)
P2="e2e-chuzhoy-$RANDOM$RANDOM@example.com"
K2=$(curl -s -X POST "$B/store/vhod" "${H[@]}" -H "x-e2e-klyuch: $EK" -d "{\"email\":\"$P2\"}" | jq -r '.["код"]')
T2=$(curl -s -X POST "$B/auth/customer/kod" "${H[@]}" -d "{\"email\":\"$P2\",\"code\":\"$K2\"}" | jq -r .token)
curl -s -X POST "$B/store/customers" "${H[@]}" -H "authorization: Bearer $T2" -d "{\"email\":\"$P2\",\"first_name\":\"Чужой\",\"last_name\":\"Тест\",\"phone\":\"+7 900 000-00-01\"}" >/dev/null
T2=$(curl -s -X POST "$B/auth/token/refresh" "${H[@]}" -H "authorization: Bearer $T2" | jq -r .token)
c=$(curl -s -o /tmp/vh.out -w "%{http_code}" "$B/store/vozvrat/$ID" "${H[@]}" -H "authorization: Bearer $T2")
check "чужой заказ — 404" 404 "$c"
c=$(curl -s -o /tmp/vh.out -w "%{http_code}" -X POST "$B/store/vozvrat/$ID" "${H[@]}" -H "authorization: Bearer $T2" -d "{\"kody\":[\"$KOD\"]}")
check "оформить возврат чужого — 404" 404 "$c"
c=$(post /store/vozvrat/$ID '{"kody":[]}' -H "authorization: Bearer $T")
check "пустой выбор — 400" 400 "$c"
c=$(post /store/vozvrat/$ID '{"kody":["nesushchestvuyushchiy"]}' -H "authorization: Bearer $T")
check "чужой код — 400" 400 "$c"
c=$(post /store/vozvrat/$ID "{\"kody\":[\"$KOD\"],\"prichina\":\"Не подошёл размер\",\"kommentariy\":\"велики в талии\"}" -H "authorization: Bearer $T")
check "свой возврат оформлен" 200 "$c"
jq -e '(.nomer|test("-В1$")) and (.pary|length)==1 and (.zayavki|length)==1 and .zayavki[0].status=="zhdem"' /tmp/vh.out >/dev/null && { OK=$((OK+1)); echo "OK   заявка видна, пара ушла из доступных"; } || { BAD=$((BAD+1)); echo "FAIL ответ: $(head -c 300 /tmp/vh.out)"; }
c=$(post /store/vozvrat/$ID "{\"kody\":[\"$KOD\"]}" -H "authorization: Bearer $T")
check "ту же пару второй раз — 400" 400 "$c"

echo "== Итог: $OK прошло, $BAD не прошло"
rm -f /tmp/vh.out
