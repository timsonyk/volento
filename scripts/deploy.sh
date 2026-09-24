#!/bin/bash
# Выкатка витрины на сервер одной командой.
#
# Зачем: Claude Code работает только через VPN, а сервер из-под VPN
# доступен через раз. Поэтому выкатку можно запускать вручную из сети
# без VPN — там связь с сервером стабильная.
#
# Запуск с компьютера:  bash scripts/deploy.sh
set -uo pipefail

SSH_OPTS="-o ConnectTimeout=30 -o ServerAliveInterval=10"

шаг() { printf "\n\033[1m%s\033[0m\n" "$1"; }

# Повторяем команду до трёх раз: связь с сервером нестабильна.
на_сервере() {
  local i out
  for i in 1 2 3; do
    if out=$(ssh $SSH_OPTS volento "$1" 2>&1); then
      printf '%s\n' "$out"
      return 0
    fi
    echo "  попытка $i не прошла, повторяю..."
    sleep 3
  done
  printf '%s\n' "$out"
  return 1
}

шаг "1/4  Забираю свежий код"
# ВАЖНО: без `set -o pipefail` на стороне сервера код возврата берётся от
# `tail`, а он успешен всегда. Из-за этого упавший git pull проходил
# незамеченным: скрипт собирал старый код и рапортовал «Готово».
want=$(git rev-parse HEAD)   # только латиница: bash не умеет кириллицу в именах
на_сервере 'cd /home/volento/volento && set -o pipefail && sudo -u volento git pull --ff-only 2>&1 | tail -3' || {
  echo
  echo "Не удалось забрать код."
  echo "Если написано про access rights — у сервера отвалился DNS хостера,"
  echo "это бывает; просто запустите выкатку ещё раз."
  echo "Если связи нет совсем — проверьте, что вы в сети БЕЗ VPN."
  exit 1
}

# Страховка: сверяем, что на сервере оказался именно тот коммит.
have=$(на_сервере 'sudo -u volento git -C /home/volento/volento rev-parse HEAD' | tr -d "[:space:]")
if [ "$have" != "$want" ]; then
  echo
  echo "На сервере другой коммит:"
  echo "  нужен: $want"
  echo "  стоит: $have"
  echo "Сборка остановлена, чтобы не выкатить старое."
  exit 1
fi
echo "  код на сервере совпадает с локальным"

шаг "2/4  Собираю витрину (несколько минут)"
на_сервере 'sudo -u volento setsid /home/volento/build-only.sh > /home/volento/deploy.log 2>&1 < /dev/null & echo "  сборка запущена"'

for i in $(seq 1 40); do
  sleep 20
  if на_сервере 'grep -aq ALL_DONE /home/volento/deploy.log && echo ГОТОВО' | grep -q ГОТОВО; then
    echo "  сборка завершена"
    break
  fi
  # Признак провала ставит сам build-only.sh по коду возврата npm.
  # Искать в логе слово «failed» нельзя: Next пишет его в обычных
  # предупреждениях — например, когда ответ не влез в кеш, — и выкатка
  # обрывалась на успешной сборке.
  if на_сервере 'grep -aq BUILD_FAILED /home/volento/deploy.log && echo ПЛОХО' | grep -q ПЛОХО; then
    echo "  ОШИБКА сборки, последние строки:"
    на_сервере 'tail -15 /home/volento/deploy.log'
    exit 1
  fi
  printf "  жду... (%s)\n" "$i"
done

шаг "3/4  Перезапускаю витрину"
на_сервере 'rm -rf /home/volento/volento/apps/storefront/.next/cache
systemctl restart volento-storefront
sleep 20
echo "  служба: $(systemctl is-active volento-storefront)"'

шаг "4/4  Проверяю страницы"
на_сервере 'for p in /ru /ru/store /ru/products/bryuki-pryamye-chernye; do
  printf "  %-38s %s\n" "$p" "$(curl -s -o /dev/null -m 15 -w "%{http_code}" -L "http://127.0.0.1:8000$p")"
done'

printf "\n\033[1mГотово. Откройте https://slytn.ru\033[0m\n"
