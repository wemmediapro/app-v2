#!/bin/bash
# À exécuter SUR le VPS après une synchro du code (mise à jour légère : build + cache + PM2)
# Appelé par update-on-vps.sh depuis la machine locale.

set -e
APP_DIR="${APP_DIR:-/var/www/gnv-app}"
export NVM_DIR="/root/.nvm"

echo "[1/6] Chargement NVM..."
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20 2>/dev/null || nvm use default

echo "[2/6] Dépendances (racine, backend, dashboard)..."
cd "$APP_DIR"
npm ci 2>/dev/null || npm install
cd backend && npm ci --omit=dev 2>/dev/null || npm install --production && cd ..
cd dashboard && (npm ci 2>/dev/null || npm install) && cd ..

echo "[3/6] Build frontend et dashboard..."
npm run build
cd dashboard && npm run build && cd ..

echo "[4/6] Vidage du cache Redis..."
if redis-cli ping 2>/dev/null | grep -q PONG; then
  redis-cli FLUSHDB
  echo "   Redis: cache vidé (FLUSHDB)"
else
  echo "   Redis non disponible, ignoré"
fi

echo "[5/6] Redémarrage PM2..."
cd "$APP_DIR" && pm2 restart ecosystem.config.cjs --env production
pm2 save

echo "[6/6] Rechargement Nginx..."
nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true

echo ""
echo "=== Mise à jour terminée ==="
echo "Cache vidé, application redémarrée."
