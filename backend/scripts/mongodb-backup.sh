#!/usr/bin/env bash
# Sauvegarde MongoDB (mongodump) — à planifier via cron ou systemd timer.
# Usage : export MONGODB_URI="mongodb://..." && ./scripts/mongodb-backup.sh
# Optionnel : BACKUP_ROOT=/var/backups/mongodb ./scripts/mongodb-backup.sh
set -euo pipefail

URI="${MONGODB_URI:-${DATABASE_URL:-}}"
if [[ -z "${URI// }" ]]; then
  echo "Erreur : définir MONGODB_URI ou DATABASE_URL." >&2
  exit 1
fi

ROOT="${BACKUP_ROOT:-./backups/mongodb}"
DAY="$(date +%Y%m%d)"
OUT="${ROOT}/${DAY}"
mkdir -p "$OUT"

echo "Dump vers $OUT ..."
mongodump --uri="$URI" --out="$OUT"

echo "OK : $OUT"
echo "Copier ce répertoire hors machine (S3, autre région) et tester une restauration sur staging."
