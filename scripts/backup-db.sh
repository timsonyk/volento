#!/bin/bash
# Резервная копия базы Volento. Запускается по таймеру systemd раз в сутки.
# Хранит копии за последние KEEP_DAYS дней, старые удаляет.
set -euo pipefail

BACKUP_DIR=/var/backups/volento
KEEP_DAYS=14
STAMP=$(date +%Y-%m-%d_%H-%M)
FILE="$BACKUP_DIR/volento_$STAMP.sql.gz"

install -d -m 750 "$BACKUP_DIR"

# пароль базы лежит только здесь, файл доступен одному root
. /root/.volento-secrets

PGPASSWORD="$DB_PASSWORD" pg_dump -h 127.0.0.1 -U volento -d volento \
  --no-owner --no-privileges | gzip -9 > "$FILE"
chmod 600 "$FILE"

# пустой или битый дамп хуже отсутствующего: проверяем оба случая
if [ "$(stat -c%s "$FILE")" -lt 1000 ]; then
  echo "ОШИБКА: дамп подозрительно маленький: $FILE" >&2
  exit 1
fi
gzip -t "$FILE"

find "$BACKUP_DIR" -name "volento_*.sql.gz" -mtime "+$KEEP_DAYS" -delete

echo "копия готова: $FILE ($(du -h "$FILE" | cut -f1))"
