#!/bin/bash
# Met à jour les fichiers de l'app sur le VPS depuis la version locale et vide le cache serveur.
# Usage: ./scripts/update-on-vps.sh
# Ou avec mot de passe: SSHPASS='votre_mot_de_passe' ./scripts/update-on-vps.sh

set -e
VPS="${VPS:-root@187.77.168.205}"
APP_DIR="/var/www/gnv-app"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
if [ -n "$SSHPASS" ]; then
  command -v sshpass &>/dev/null || { echo "Installez sshpass (brew install sshpass / apt install sshpass) pour utiliser SSHPASS"; exit 1; }
  export SSHPASS
  SSH_E="sshpass -e ssh -o StrictHostKeyChecking=no"
else
  SSH_E="ssh -o StrictHostKeyChecking=no"
fi

echo "Source: $SRC"
echo "Cible:  $VPS:$APP_DIR"
echo ""

echo "[1/2] Synchronisation des fichiers (exclusion node_modules, .git, config)..."
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
  "$SRC/" "$VPS:$APP_DIR/"

echo "[2/2] Build, vidage du cache et redémarrage sur le VPS..."
$SSH_E "$VPS" "APP_DIR=$APP_DIR bash $APP_DIR/scripts/update-on-vps-remote.sh"

echo ""
echo "Déploiement et mise à jour terminés. Cache serveur vidé."
echo "Ouvrez: http://187.77.168.205"
