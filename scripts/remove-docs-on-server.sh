#!/bin/bash
# Supprime toute la documentation (.md, docs/, README, etc.) sur le serveur d'hébergement.
# Usage: ./scripts/remove-docs-on-server.sh
#        VPS=root@IP ./scripts/remove-docs-on-server.sh
#        SSHPASS='...' ./scripts/remove-docs-on-server.sh

set -e
VPS="${VPS:-root@187.77.168.205}"
APP_DIR="${APP_DIR:-/var/www/gnv-app}"

if [ -n "$SSHPASS" ]; then
  command -v sshpass &>/dev/null || { echo "Installez sshpass pour utiliser SSHPASS"; exit 1; }
  export SSHPASS
  SSH_E="sshpass -e ssh -o StrictHostKeyChecking=no"
else
  SSH_E="ssh -o StrictHostKeyChecking=no"
fi

echo "Suppression de toute la documentation sur $VPS:$APP_DIR"
echo ""

REMOTE_SCRIPT='
APP_DIR="${APP_DIR:-/var/www/gnv-app}"
cd "$APP_DIR" || exit 1
# Dossiers docs
for d in docs backend/docs; do
  if [ -d "$d" ]; then
    rm -rf "$d"
    echo "  supprimé: $d/"
  fi
done
# Tous les .md (hors node_modules)
find . -name "*.md" -not -path "*/node_modules/*" -type f 2>/dev/null | while read -r f; do
  rm -f "$f" && echo "  supprimé: $f"
done
echo "Documentation supprimée."
'

$SSH_E "$VPS" "APP_DIR=$APP_DIR bash -s" <<< "$REMOTE_SCRIPT" || { echo "Connexion SSH échouée."; exit 1; }

echo ""
echo "Terminé."
