#!/bin/bash
# Sync uploads (images, vidéos, audio) vers le VPS.
# Usage: SSHPASS='mot_de_passe' ./scripts/sync-uploads-to-vps.sh
set -e
cd "$(dirname "$0")/.."
VPS="${VPS:-root@187.77.168.205}"

if [ -z "$SSHPASS" ]; then
  echo "Usage: SSHPASS='votre_mot_de_passe' $0"
  exit 1
fi

export SSHPASS
echo "Synchronisation des médias vers $VPS (peut prendre plusieurs minutes)..."
sshpass -e rsync -avz --progress \
  -e "ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=6" \
  backend/public/uploads/ \
  "$VPS:/var/www/gnv-app/backend/public/uploads/"

echo "✅ Sync terminée."
