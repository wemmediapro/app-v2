#!/bin/bash
# Déploiement complet : code + installation (Node, MongoDB, Redis, Nginx, PM2) + import base de données
# Usage: SSHPASS='votre_mot_de_passe' ./scripts/deploy-install-and-import-vps.sh
# Ou: ./scripts/deploy-install-and-import-vps.sh  (vous taperez le mot de passe 2 fois)

set -e
VPS="${VPS:-root@187.77.168.205}"
APP_DIR="/var/www/gnv-app"
VPS_IP="${VPS_IP:-187.77.168.205}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"

if [ -n "$SSHPASS" ]; then
  command -v sshpass &>/dev/null || { echo "Installez sshpass (brew install sshpass / apt install sshpass) pour utiliser SSHPASS"; exit 1; }
  export SSHPASS
  SSH_E="sshpass -e ssh -o StrictHostKeyChecking=no"
else
  SSH_E="ssh -o StrictHostKeyChecking=no"
fi

echo "=============================================="
echo "  Déploiement complet → $VPS_IP"
echo "=============================================="
echo ""

echo "[1/4] Connexion et répertoire sur le VPS..."
$SSH_E "$VPS" "mkdir -p $APP_DIR" || { echo "Connexion SSH échouée. Vérifiez IP/mot de passe."; exit 1; }

echo "[2/4] Synchronisation du code..."
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
  --exclude 'backend/public/uploads' \
  "$SRC/" "$VPS:$APP_DIR/"

echo "[3/4] Installation (Node, MongoDB, Redis, Nginx, build, PM2)..."
$SSH_E "$VPS" "VPS_IP=$VPS_IP APP_DIR=$APP_DIR bash $APP_DIR/scripts/install-on-vps-resume.sh"

echo "[4/4] Import / initialisation de la base de données..."
$SSH_E "$VPS" "APP_DIR=$APP_DIR bash $APP_DIR/scripts/import-database-vps.sh"

echo ""
echo "=============================================="
echo "  Déploiement terminé"
echo "=============================================="
echo "  Application : http://$VPS_IP"
echo "  API santé    : http://$VPS_IP/api/health"
echo "  Dashboard    : http://$VPS_IP/dashboard/"
echo ""
