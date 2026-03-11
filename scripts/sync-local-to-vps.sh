#!/bin/bash
# Copie le contenu de localhost vers le VPS :
#   1. Export MongoDB local (gnv_onboard) → dump-mongodb
#   2. Envoi du dump sur le VPS
#   3. Restauration sur le VPS (--drop)
#   4. (Optionnel) Sync backend/public/uploads vers le VPS
#
# Usage: SSHPASS='mot_de_passe' ./scripts/sync-local-to-vps.sh
# Prérequis: MongoDB tourne en local, sshpass installé

set -e
VPS="${VPS:-root@187.77.168.205}"
APP_DIR="/var/www/gnv-app"
SRC="$(cd "$(dirname "$0")/.." && pwd)"

if [ -n "$SSHPASS" ]; then
  export SSHPASS
  SSH_E="sshpass -e ssh -o StrictHostKeyChecking=no"
  RSYNC_E="sshpass -e rsync -avz -e \"ssh -o StrictHostKeyChecking=no\""
else
  SSH_E="ssh -o StrictHostKeyChecking=no"
fi

echo "=== Export base locale gnv_onboard ==="
mkdir -p "$SRC/dump-mongodb"
mongodump --uri="mongodb://localhost:27017" --db=gnv_onboard --out="$SRC/dump-mongodb" 2>&1 || { echo "Erreur: MongoDB doit tourner en local (mongod)"; exit 1; }

echo ""
echo "=== Envoi du dump sur le VPS ==="
$SSH_E "$VPS" "mkdir -p $APP_DIR"
if [ -n "$SSHPASS" ]; then
  sshpass -e rsync -avz -e "ssh -o StrictHostKeyChecking=no" "$SRC/dump-mongodb/" "$VPS:$APP_DIR/dump-mongodb/"
else
  rsync -avz -e "ssh -o StrictHostKeyChecking=no" "$SRC/dump-mongodb/" "$VPS:$APP_DIR/dump-mongodb/"
fi

echo ""
echo "=== Restauration sur le VPS (remplace la base) ==="
$SSH_E "$VPS" "mongorestore --uri='mongodb://localhost:27017' --db=gnv_onboard --drop $APP_DIR/dump-mongodb/gnv_onboard"

echo ""
echo "=== Sync des médias (uploads) — peut être long ==="
if [ -d "$SRC/backend/public/uploads" ] && [ -n "$(ls -A "$SRC/backend/public/uploads" 2>/dev/null)" ]; then
  if [ -n "$SSHPASS" ]; then
    sshpass -e rsync -avz -e "ssh -o StrictHostKeyChecking=no" "$SRC/backend/public/uploads/" "$VPS:$APP_DIR/backend/public/uploads/" || echo "⚠ Sync uploads interrompu (relancez si besoin)."
  else
    rsync -avz -e "ssh -o StrictHostKeyChecking=no" "$SRC/backend/public/uploads/" "$VPS:$APP_DIR/backend/public/uploads/" || echo "⚠ Sync uploads interrompu (relancez si besoin)."
  fi
else
  echo "   Pas de dossier uploads en local, ignoré."
fi

echo ""
echo "✅ Contenu local copié sur le VPS."
echo "   Application: http://187.77.168.205"
echo "   Dashboard:   http://187.77.168.205/dashboard/"
echo "   Connexion admin: admin@gnv.com / (mot de passe de votre base locale ou Admin123! si réinitialisé)"
