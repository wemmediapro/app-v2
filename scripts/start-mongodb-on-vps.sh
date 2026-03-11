#!/bin/bash
# Démarre MongoDB sur le VPS puis redémarre le backend.
# Usage: ./scripts/start-mongodb-on-vps.sh
# Avec mot de passe: SSHPASS='votre_mot_de_passe' ./scripts/start-mongodb-on-vps.sh

set -e
VPS="${VPS:-root@187.77.168.205}"
APP_DIR="${APP_DIR:-/var/www/gnv-app}"

if [ -n "$SSHPASS" ]; then
  command -v sshpass &>/dev/null || { echo "Installez sshpass (brew install sshpass) pour utiliser SSHPASS"; exit 1; }
  export SSHPASS
  SSH_E="sshpass -e ssh -o StrictHostKeyChecking=no"
else
  SSH_E="ssh -o StrictHostKeyChecking=no"
fi

echo "Connexion à $VPS..."
echo ""

echo "[1/4] Démarrage de MongoDB (et activation au boot)..."
$SSH_E "$VPS" "systemctl enable mongod 2>/dev/null; systemctl start mongod" || { echo "Échec systemctl start mongod. Vérifiez que MongoDB est installé (scripts/install-on-vps-remote.sh)."; exit 1; }

echo "[2/4] Vérification MongoDB..."
$SSH_E "$VPS" "sleep 2 && (mongosh --quiet --eval 'db.version()' 2>/dev/null && echo 'MongoDB OK') || echo '⚠ MongoDB a démarré mais mongosh non disponible'"

echo "[3/4] Vérification backend/config.env..."
$SSH_E "$VPS" "grep -q MONGODB_URI $APP_DIR/backend/config.env 2>/dev/null && echo 'config.env contient MONGODB_URI' || echo '⚠ Fichier backend/config.env manquant ou sans MONGODB_URI'"

echo "[4/4] Redémarrage du backend..."
$SSH_E "$VPS" "export NVM_DIR=/root/.nvm && [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\" && cd $APP_DIR && pm2 restart gnv-backend 2>/dev/null || pm2 start ecosystem.config.cjs --only gnv-backend --env production"
$SSH_E "$VPS" "export NVM_DIR=/root/.nvm && [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\" && pm2 save 2>/dev/null || true"

echo ""
echo "Attente de la connexion backend → MongoDB (5 s)..."
sleep 5
echo "Vérification /api/health..."
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://187.77.168.205/api/health" 2>/dev/null || true

echo ""
echo "Terminé. Rechargez la page du dashboard (Ctrl+Shift+R si besoin) : http://187.77.168.205/dashboard/webtv"
