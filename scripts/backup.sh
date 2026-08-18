#!/bin/bash
# Резервная копия Volento: база данных и фотографии товаров.
# Запускается по таймеру systemd раз в сутки.
#
# База маленькая, поэтому копий держим много. Фотографии весят заметно
# больше и меняются редко — их копий храним меньше.
set -euo pipefail

BACKUP_DIR=/var/backups/volento
UPLOAD_DIR=/var/lib/volento/uploads
KEEP_DB_DAYS=14
KEEP_PHOTO_COPIES=3
STAMP=$(date +%Y-%m-%d_%H-%M)

install -d -m 750 "$BACKUP_DIR"

# --- база ---
DB_FILE="$BACKUP_DIR/volento_$STAMP.sql.gz"

# пароль базы лежит только здесь, файл доступен одному root
. /root/.volento-secrets

PGPASSWORD="$DB_PASSWORD" pg_dump -h 127.0.0.1 -U volento -d volento \
  --no-owner --no-privileges | gzip -9 > "$DB_FILE"
chmod 600 "$DB_FILE"

# пустой или битый дамп хуже отсутствующего: проверяем оба случая
if [ "$(stat -c%s "$DB_FILE")" -lt 1000 ]; then
  echo "ОШИБКА: дамп базы подозрительно маленький: $DB_FILE" >&2
  exit 1
fi
gzip -t "$DB_FILE"

find "$BACKUP_DIR" -name "volento_*.sql.gz" -mtime "+$KEEP_DB_DAYS" -delete

echo "база: $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"

# --- фотографии товаров ---
# Без них восстановленный магазин будет с пустыми карточками:
# в дампе базы лежат только ссылки на файлы.
if [ -d "$UPLOAD_DIR" ] && [ -n "$(ls -A "$UPLOAD_DIR" 2>/dev/null)" ]; then
  PHOTO_FILE="$BACKUP_DIR/photos_$STAMP.tar.gz"
  tar -czf "$PHOTO_FILE" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
  chmod 600 "$PHOTO_FILE"
  gzip -t "$PHOTO_FILE"

  # оставляем только последние KEEP_PHOTO_COPIES архивов
  ls -1t "$BACKUP_DIR"/photos_*.tar.gz 2>/dev/null \
    | tail -n "+$((KEEP_PHOTO_COPIES + 1))" \
    | xargs -r rm -f

  echo "фотографии: $PHOTO_FILE ($(du -h "$PHOTO_FILE" | cut -f1))"
else
  echo "фотографии: папка пуста, копировать нечего"
fi
