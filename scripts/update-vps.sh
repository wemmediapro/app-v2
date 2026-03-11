#!/bin/bash
# Mise à jour sur le VPS : sync code, build, reload PM2.
# Optionnel : mettre à jour la base avec la base locale (UPDATE_DB=1 ou --with-db).
#
# Usage:
#   ./scripts/update-vps.sh                    # mise à jour code uniquement
#   UPDATE_DB=1 ./scripts/update-vps.sh         # code + base de données
#   ./scripts/update-vps.sh --with-db          # idem
#   SSHPASS='mot_de_passe' ./scripts/update-vps.sh --with-db

set -e
VPS="${VPS:-root@187.77.168.205}"
APP_DIR="${APP_DIR:-/var/www/gnv-app}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"

# Option --with-db
UPDATE_DB="${UPDATE_DB:-0}"
[ "$1" = "--with-db" ] && UPDATE_DB=1

if [ -n "$SSHPASS" ]; then
  command -v sshpass &>/dev/null || { echo "Installez sshpass (brew install sshpass / apt install sshpass) pour utiliser SSHPASS"; exit 1; }
  export SSHPASS
  SSH_E="sshpass -e ssh -o StrictHostKeyChecking=no"
else
  SSH_E="ssh -o StrictHostKeyChecking=no"
fi

echo "Mise à jour de l'application sur le VPS"
echo "Source: $SRC"
echo "Cible:  $VPS:$APP_DIR"
[ "$UPDATE_DB" = "1" ] && echo "Base de données: mise à jour incluse (export local → import sur le VPS)"
echo ""

# --- Export base locale si UPDATE_DB=1 ---
RSYNC_EXCLUDE_DUMP="--exclude 'dump-mongodb'"
if [ "$UPDATE_DB" = "1" ]; then
  MONGODB_URI="mongodb://localhost:27017/gnv_onboard?directConnection=true"
  DB_NAME="gnv_onboard"
  for envfile in "$SRC/backend/config.env" "$SRC/backend/.env"; do
    if [ -f "$envfile" ]; then
      val=$(grep -E '^(MONGODB_URI|DATABASE_URL)=' "$envfile" 2>/dev/null | head -1 | cut -d= -f2- | sed -e "s/^['\"]//" -e "s/['\"]$//")
      [ -n "$val" ] && MONGODB_URI="$val" && break
    fi
  done
  if [[ "$MONGODB_URI" =~ /([a-zA-Z0-9_-]+)(\?|$) ]]; then DB_NAME="${BASH_REMATCH[1]}"; fi

  echo "[0/6] Export de la base de données locale ($DB_NAME)..."
  DUMP_DIR="$SRC/dump-mongodb"
  rm -rf "$DUMP_DIR"
  if command -v mongodump &>/dev/null; then
    if mongodump --uri="$MONGODB_URI" --out="$DUMP_DIR" 2>/dev/null; then
      echo "    Base exportée dans dump-mongodb/"
      RSYNC_EXCLUDE_DUMP=""   # on envoie le dump
    else
      echo "    Attention: export échoué (MongoDB local démarré ?). Mise à jour sans base."
    fi
  else
    echo "    mongodump non trouvé. Mise à jour sans base."
  fi
fi

# Numéros d'étapes
if [ "$UPDATE_DB" = "1" ] && [ -z "$RSYNC_EXCLUDE_DUMP" ]; then
  STEP_TOTAL=6
else
  STEP_TOTAL=4
fi

echo "[1/$STEP_TOTAL] Synchronisation du code..."
rsync -avz --delete -e "$SSH_E" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'backend/node_modules' \
  --exclude 'dashboard/node_modules' \
  --exclude 'logs' \
  --exclude '*.log' \
  --exclude 'backend/config.env' \
  --exclude 'backend/.env' \
  --exclude '.env' \
  $RSYNC_EXCLUDE_DUMP \
  "$SRC/" "$VPS:$APP_DIR/"

echo "[2/$STEP_TOTAL] Installation des dépendances et build sur le VPS..."
$SSH_E "$VPS" "export NVM_DIR=/root/.nvm && [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"; cd $APP_DIR && npm ci 2>/dev/null || npm install && cd backend && npm ci --omit=dev 2>/dev/null || npm install --production && cd .. && cd dashboard && (npm ci 2>/dev/null || npm install) && cd .. && npm run build && cd dashboard && npm run build && cd .."

echo "[3/$STEP_TOTAL] Rechargement des processus PM2..."
$SSH_E "$VPS" "export NVM_DIR=/root/.nvm && [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"; cd $APP_DIR && (pm2 reload all 2>/dev/null || pm2 start ecosystem.config.cjs --env production)"

if [ "$UPDATE_DB" = "1" ] && [ -z "$RSYNC_EXCLUDE_DUMP" ]; then
  echo "[5/6] Import de la base de données sur le VPS..."
  $SSH_E "$VPS" "APP_DIR=$APP_DIR bash $APP_DIR/scripts/import-database-vps.sh"
  echo "[6/6] Sauvegarde PM2..."
else
  echo "[4/4] Sauvegarde PM2..."
fi
$SSH_E "$VPS" "pm2 save 2>/dev/null || true"

echo ""
echo "Mise à jour terminée."
[ "$UPDATE_DB" = "1" ] && [ -z "$RSYNC_EXCLUDE_DUMP" ] && echo "Base de données: restaurée depuis la copie locale."
echo "Backend:  http://${VPS#*@}/api/health"
echo "Frontend: http://${VPS#*@}/"
echo "Logs:     ssh $VPS 'pm2 logs gnv-backend --lines 30'"
