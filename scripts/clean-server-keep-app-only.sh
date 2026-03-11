#!/bin/bash
# Nettoie le VPS et ne garde que les fichiers liés à l'application.
# Appelle clean-server-keep-app-only-remote.sh sur le serveur via SSH.
#
# Usage:
#   ./scripts/clean-server-keep-app-only.sh
#   SSHPASS='mot_de_passe' ./scripts/clean-server-keep-app-only.sh
#
# Variables: VPS=user@ip  APP_DIR=/var/www/gnv-app

set -e
VPS="${VPS:-root@187.77.168.205}"
APP_DIR="${APP_DIR:-/var/www/gnv-app}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"

if [ -n "$SSHPASS" ]; then
  command -v sshpass &>/dev/null || { echo "Installez sshpass pour utiliser SSHPASS"; exit 1; }
  export SSHPASS
  SSH_E="sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10"
  RSYNC_E="sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10"
else
  SSH_E="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10"
  RSYNC_E="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10"
fi

echo "Connexion au VPS: $VPS"
echo "Répertoire app:   $APP_DIR"
echo ""

# Envoyer le script remote sur le VPS puis l'exécuter
rsync -a -e "$RSYNC_E" "$SRC/scripts/clean-server-keep-app-only-remote.sh" "$VPS:$APP_DIR/scripts/" 2>/dev/null || \
  true

$SSH_E "$VPS" "APP_DIR=$APP_DIR bash $APP_DIR/scripts/clean-server-keep-app-only-remote.sh"

echo ""
echo "Serveur nettoyé. Seuls les fichiers liés à l'application sont conservés."
