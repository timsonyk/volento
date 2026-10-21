#!/bin/bash
# Прогон сценариев документа для склада («Обмен со складом — API Volento»)
# на тестовых заказах. Запускать на сервере от root:
#   scp scripts/sklad-scenarii.sh volento:/root/ && ssh volento bash /root/sklad-scenarii.sh
#
# Настоящие заказы и остатки не трогает: артикулы выдуманные, заказы
# тестовые (видны складу только с ?test=1), касса, банк и служба доставки
# по ним не вызываются. Каждый прогон оставляет 5 тестовых заказов по 10 ₽
# и шлёт 2 письма-тревоги «склад собрал не всё» на EMAIL_TREVOGA.
set -u
B=${B:-http://127.0.0.1:9000}
K=$(grep '^SKLAD_KEY=' /home/volento/volento/apps/backend/.env | cut -d= -f2-)
set -a; . /root/.volento-secrets; set +a
OK=0; BAD=0

# r МЕТОД ПУТЬ [ТЕЛО] — печатает код ответа, тело в /tmp/sk.out
r() { curl -s -o /tmp/sk.out -w "%{http_code}" -X "$1" "$B$2" -H "X-Sklad-Key: $K" -H "Content-Type: application/json" ${3:+-d "$3"}; }
# ждём: название, ожидаемый код, фактический код, [jq-условие на тело]
check() {
  local name=$1 want=$2 got=$3 cond=${4:-}
  local ok=1
  [ "$got" = "$want" ] || ok=0
  if [ -n "$cond" ] && ! jq -e "$cond" /tmp/sk.out >/dev/null 2>&1; then ok=0; fi
  if [ $ok = 1 ]; then OK=$((OK+1)); echo "OK   $name ($got)"; else BAD=$((BAD+1)); echo "FAIL $name: код $got, ждали $want; тело: $(head -c 300 /tmp/sk.out)"; fi
}
novyi() { r POST /sklad/proba/zakaz "$1" >/dev/null; jq -r .nomer /tmp/sk.out; }
stroki() { curl -s "$B/sklad/zadaniya?test=1" -H "X-Sklad-Key: $K" | jq -c --arg n "$1" '[.zadaniya[]|select(.nomer==$n)|.pozicii[]|.id_stroki]'; }
# id заказа по номеру — из заданий склада (фильтр display_id в админке Medusa не работает)
idz() { curl -s "$B/sklad/zadaniya?test=1" -H "X-Sklad-Key: $K" | jq -r --arg n "$1" '.zadaniya[]|select(.nomer==$n)|.id'; }
kod() { printf '0104601234567890215%s\\u001d93TeSt' "$1"; }

echo "== Подключение"
c=$(curl -s -o /tmp/sk.out -w "%{http_code}" "$B/sklad/zadaniya"); check "без ключа 401" 401 "$c"
c=$(curl -s -o /tmp/sk.out -w "%{http_code}" "$B/sklad/zadaniya" -H "X-Sklad-Key: neverno"); check "неверный ключ 401" 401 "$c"
c=$(curl -s -o /tmp/sk.out -w "%{http_code}" "https://api.slytn.ru/sklad/zadaniya?test=1" -H "X-Sklad-Key: $K"); check "через api.slytn.ru" 200 "$c" '.zadaniya'

echo "== 1. Остатки (только выдуманные артикулы)"
c=$(r POST /sklad/ostatki '{"ostatki":[{"artikul":"ZZTEST-46/170","kolichestvo":4},{"model":"ZZTEST","razmer":"48","rost":"176","kolichestvo":2},{"artikul":"ZZTEST-38","kolichestvo":0}]}')
check "выдуманные артикулы в ne_nashli" 200 "$c" '.prinyato==0 and (.ne_nashli|length)==3'
c=$(r POST /sklad/ostatki '{"ostatki":[{"artikul":"ZZTEST-46/170","kolichestvo":1},{"kolichestvo":5}]}')
check "непонятная строка в ne_razobrali" 200 "$c" '(.ne_razobrali|length)==1'
big=$(jq -nc '{ostatki:[range(2001)|{artikul:"ZZTEST-\(.)/170",kolichestvo:1}]}')
c=$(r POST /sklad/ostatki "$big"); check "2001 позиция 400" 400 "$c"
c=$(r POST /sklad/ostatki '{"ostatki":[]}'); check "пустой список 400" 400 "$c"

echo "== 9. Сверка"
c=$(r GET "/sklad/ostatki-proverka?offset=0"); check "весь каталог" 200 "$c" '.vsego>0 and (.ostatki|length)>0 and .limit==2000'
A=$(jq -r '.ostatki[0].artikul' /tmp/sk.out)
c=$(r GET "/sklad/ostatki-proverka?artikul=$(jq -rn --arg a "$A" '$a|@uri')"); check "одна позиция $A" 200 "$c" '.ostatki[0].artikul and (.ostatki[0]|has("v_rezerve"))'
c=$(r GET "/sklad/ostatki-proverka?artikul=ZZTEST-1/170"); check "нет артикула 404" 404 "$c"

echo "== Полный путь: заказ [2,1]"
c=$(r POST /sklad/proba/zakaz '{"kolichestva":[2,1]}'); check "тестовый заказ" 200 "$c" '.nomer'
N=$(jq -r .nomer /tmp/sk.out)
c=$(r GET "/sklad/zadaniya?test=1"); check "виден в ?test=1" 200 "$c" "[.zadaniya[]|select(.nomer==\"$N\")]|length==1 and .[0].vzyato==false and (.[0].pozicii|length)==2 and .[0].dostavka.sposob==\"pvz\" and .[0].poluchatel.telefon"
c=$(r GET "/sklad/zadaniya"); check "не виден в обычном списке" 200 "$c" "[.zadaniya[]|select(.nomer==\"$N\")]|length==0"
S=$(stroki "$N"); S1=$(jq -r '.[0]' <<<"$S"); S2=$(jq -r '.[1]' <<<"$S")
c=$(r POST /sklad/zadaniya/$N/vzyat); check "собираю" 200 "$c" '.sostoyanie=="vzyat"'
c=$(r POST /sklad/zadaniya/$N/vzyat); check "собираю повтор" 200 "$c" '.sostoyanie=="vzyat"'
c=$(r GET "/sklad/zadaniya?test=1"); check "vzyato:true" 200 "$c" "[.zadaniya[]|select(.nomer==\"$N\")][0].vzyato==true"
c=$(r GET /sklad/zadaniya/$N/etiketka); check "наклейка до сборки 404" 404 "$c"
c=$(r POST /sklad/zadaniya/$N/upakovano); check "упаковано до сборки 409" 409 "$c"
c=$(r POST /sklad/zadaniya/$N/sborka "{\"pozicii\":[{\"id_stroki\":\"$S1\",\"kolichestvo\":2,\"kody\":[\"$(kod a$N)\"]},{\"id_stroki\":\"$S2\",\"kolichestvo\":1,\"kody\":[\"$(kod b$N)\"]}]}")
check "кодов меньше, чем штук 400" 400 "$c"
c=$(r POST /sklad/zadaniya/$N/sborka "{\"pozicii\":[{\"id_stroki\":\"$S1\",\"kolichestvo\":2,\"kody\":[\"$(kod a$N)\",\"$(kod c$N)\",\"$(kod d$N)\"]},{\"id_stroki\":\"$S2\",\"kolichestvo\":1,\"kody\":[\"$(kod b$N)\"]}]}")
check "кодов больше 400" 400 "$c"
c=$(r POST /sklad/zadaniya/$N/sborka "{\"pozicii\":[{\"id_stroki\":\"$S1\",\"kolichestvo\":2,\"kody\":[\"$(kod a$N)\",\"НЕКОД\"]},{\"id_stroki\":\"$S2\",\"kolichestvo\":1,\"kody\":[\"$(kod b$N)\"]}]}")
check "не код маркировки 400" 400 "$c"
c=$(r POST /sklad/zadaniya/$N/sborka "{\"pozicii\":[{\"id_stroki\":\"$S1\",\"kolichestvo\":2,\"kody\":[\"$(kod a$N)\",\"$(kod a$N)\"]},{\"id_stroki\":\"$S2\",\"kolichestvo\":1,\"kody\":[\"$(kod b$N)\"]}]}")
check "код дважды 400" 400 "$c"
c=$(r POST /sklad/zadaniya/$N/sborka "{\"pozicii\":[{\"id_stroki\":\"$S2\",\"kolichestvo\":1,\"kody\":[\"$(kod b$N)\"]},{\"id_stroki\":\"$S2\",\"kolichestvo\":1,\"kody\":[\"$(kod e$N)\"]}]}")
check "строка дважды 400" 400 "$c"
c=$(r POST /sklad/zadaniya/$N/sborka "{\"pozicii\":[{\"id_stroki\":\"$S1\",\"kolichestvo\":0,\"kody\":[]}]}")
check "ничего не собрано 400" 400 "$c" '.podskazka'
c=$(r POST /sklad/zadaniya/$N/sborka "{\"pozicii\":[{\"id_stroki\":\"$S1\",\"kolichestvo\":2,\"kody\":[\"$(kod a$N)\",\"$(kod c$N)\"]},{\"artikul\":\"TEST-48/176\",\"kolichestvo\":1,\"kody\":[\"$(kod b$N)\"]}]}")
check "собрано (строка по artikul)" 200 "$c" '.sostoyanie=="v_sborke"'
c=$(r POST /sklad/zadaniya/$N/sborka '{"pozicii":[]}'); check "собрано повтор" 200 "$c" '.sostoyanie=="uzhe_v_sborke"'
c=$(r GET "/sklad/zadaniya?test=1"); check "ушёл из заданий" 200 "$c" "[.zadaniya[]|select(.nomer==\"$N\")]|length==0"
c=$(r POST /sklad/zadaniya/$N/otkaz); check "отказ после сборки 409" 409 "$c"
c=$(r GET "/sklad/k-upakovke?test=1"); check "в к упаковке" 200 "$c" "[.k_upakovke[]|select(.nomer==\"$N\")]|length==1 and .[0].perevozchik==\"test\" and .[0].trek==\"TEST-$N\" and (.[0].pozicii|map(.kolichestvo)|add)==3"
c=$(r GET "/sklad/k-upakovke"); check "не в обычном к упаковке" 200 "$c" "[.k_upakovke[]|select(.nomer==\"$N\")]|length==0"
c=$(curl -s -o /tmp/sk.pdf -w "%{http_code} %{content_type}" "$B/sklad/zadaniya/$N/etiketka" -H "X-Sklad-Key: $K")
if [[ "$c" == "200 application/pdf"* ]] && head -c4 /tmp/sk.pdf | grep -q %PDF && grep -q "212.6 340.2" /tmp/sk.pdf; then OK=$((OK+1)); echo "OK   наклейка PDF 75x120"; else BAD=$((BAD+1)); echo "FAIL наклейка: $c"; fi
c=$(r POST /sklad/zadaniya/$N/upakovano); check "упаковано" 200 "$c" '.sostoyanie=="upakovan"'
c=$(r POST /sklad/zadaniya/$N/upakovano); check "упаковано повтор" 200 "$c" '.sostoyanie=="uzhe_upakovan"'
c=$(r GET "/sklad/k-upakovke?test=1"); check "ушёл из к упаковке" 200 "$c" "[.k_upakovke[]|select(.nomer==\"$N\")]|length==0"
c=$(r GET /sklad/zadaniya/$N/etiketka); check "наклейка после упаковки 404" 404 "$c"

echo "== 5. Отказ"
N=$(novyi '{"kolichestva":[1]}')
c=$(r POST /sklad/zadaniya/$N/otkaz '{"prichina":"net_na_sklade"}'); check "отказ" 200 "$c" '.sostoyanie=="otmenen"'
c=$(r POST /sklad/zadaniya/$N/otkaz); check "отказ повтор" 200 "$c" '.sostoyanie=="uzhe_otmenen"'
c=$(r POST /sklad/zadaniya/$N/vzyat); check "собираю по отменённому 409" 409 "$c"
c=$(r POST /sklad/zadaniya/$N/sborka '{"pozicii":[]}'); check "собрано по отменённому 409" 409 "$c"
c=$(r GET "/sklad/zadaniya?test=1"); check "отменённый не в заданиях" 200 "$c" "[.zadaniya[]|select(.nomer==\"$N\")]|length==0"
N=$(novyi '')
r POST /sklad/zadaniya/$N/vzyat >/dev/null
c=$(r POST /sklad/zadaniya/$N/otkaz '{}'); check "отказ после «собираю», без причины" 200 "$c" '.sostoyanie=="otmenen"'
echo "OTKAZ_NOMER=$N"
c=$(r POST /sklad/zadaniya/999999/vzyat); check "нет заказа 404" 404 "$c"

echo "== Неполная сборка, покупатель согласен на остаток"
T=$(curl -s -X POST "$B/auth/user/emailpass" -H "Content-Type: application/json" -d "$(jq -nc --arg e "$ADMIN_EMAIL" --arg p "$ADMIN_PASSWORD" '{email:$e,password:$p}')" | jq -r .token)
N=$(novyi '{"kolichestva":[2,1]}'); ID=$(idz "$N"); S=$(stroki "$N"); S1=$(jq -r '.[0]' <<<"$S"); S2=$(jq -r '.[1]' <<<"$S")
c=$(r POST /sklad/zadaniya/$N/sborka "{\"pozicii\":[{\"id_stroki\":\"$S1\",\"kolichestvo\":1,\"kody\":[\"$(kod p$N)\"]}]}")
check "собрано 1 из 3 штук" 200 "$c" '.sostoyanie=="zhdem_klienta"'
c=$(r POST /sklad/zadaniya/$N/sborka '{"pozicii":[]}'); check "повтор zhdem_klienta" 200 "$c" '.sostoyanie=="zhdem_klienta"'
c=$(r GET "/sklad/zadaniya?test=1"); check "на паузе — не в заданиях" 200 "$c" "[.zadaniya[]|select(.nomer==\"$N\")]|length==0"
c=$(curl -s -o /tmp/sk.out -w "%{http_code}" -X POST "$B/admin/sklad/zakazy/$ID/ostatok" -H "Authorization: Bearer $T"); check "админка: «Отправить остаток»" 200 "$c"
c=$(r GET "/sklad/k-upakovke?test=1"); check "остаток пришёл к упаковке, 1 шт." 200 "$c" "[.k_upakovke[]|select(.nomer==\"$N\")]|length==1 and (.[0].pozicii|map(.kolichestvo)|add)==1"
curl -s "$B/admin/orders/$ID?fields=metadata,total,summary.*,payment_collections.payments.refunds.amount" -H "Authorization: Bearer $T" > /tmp/sk.out
jq -c '{kody: .order.metadata.kody_markirovki, total: .order.total, vozvrat: [.order.payment_collections[].payments[].refunds[]?.amount]}' /tmp/sk.out
c=$(r POST /sklad/zadaniya/$N/upakovano); check "остаток упакован" 200 "$c" '.sostoyanie=="upakovan"'

echo "== Неполная сборка, покупатель отказался"
N=$(novyi '{"kolichestva":[2]}'); ID=$(idz "$N"); S1=$(stroki "$N" | jq -r '.[0]')
c=$(r POST /sklad/zadaniya/$N/sborka "{\"pozicii\":[{\"id_stroki\":\"$S1\",\"kolichestvo\":1,\"kody\":[\"$(kod q$N)\"]}]}"); check "собрано 1 из 2" 200 "$c" '.sostoyanie=="zhdem_klienta"'
c=$(curl -s -o /tmp/sk.out -w "%{http_code}" -X POST "$B/admin/sklad/zakazy/$ID/otmena" -H "Authorization: Bearer $T"); check "админка: «Отменить заказ»" 200 "$c"
curl -s "$B/admin/orders/$ID?fields=status,payment_collections.payments.refunds.amount" -H "Authorization: Bearer $T" | jq -c '{status: .order.status, vozvrat: [.order.payment_collections[].payments[].refunds[]?.amount]}'
c=$(r GET "/sklad/k-upakovke?test=1"); check "отменённый не в к упаковке" 200 "$c" "[.k_upakovke[]|select(.nomer==\"$N\")]|length==0"

echo "== Итог: $OK прошло, $BAD не прошло"
rm -f /tmp/sk.out /tmp/sk.pdf
