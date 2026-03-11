#!/bin/bash
# Liste les fichiers potentiellement inutiles sur le serveur d'hébergement (sans rien supprimer).
# Usage: ./scripts/check-unused-files-on-server.sh
#        SSHPASS='...' ./scripts/check-unused-files-on-server.sh

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

echo "=== Vérification des fichiers inutiles sur $VPS:$APP_DIR ==="
echo ""

REMOTE_SCRIPT='
APP_DIR="${APP_DIR:-/var/www/gnv-app}"
cd "$APP_DIR" || exit 1

echo "--- Fichiers .md (documentation) ---"
find . -name "*.md" -not -path "*/node_modules/*" -type f 2>/dev/null | head -100
c=$(find . -name "*.md" -not -path "*/node_modules/*" -type f 2>/dev/null | wc -l)
echo "Total: $c fichier(s)"
echo ""

echo "--- Dossiers docs/ ---"
for d in docs backend/docs dashboard/docs; do
  if [ -d "$d" ]; then
    echo "  $d/ ($(du -sh "$d" 2>/dev/null | cut -f1))"
  fi
done
echo ""

echo "--- Dossiers export / sauvegarde (souvent inutiles en prod) ---"
for d in export-config-vps-online-20260228_0059 export-config-hebergement-20260228_0055 database-export-complete-20260214_213918 database-export-20260214_213903 dump-mongodb; do
  if [ -d "$d" ]; then
    echo "  $d/ ($(du -sh "$d" 2>/dev/null | cut -f1))"
  fi
done
find . -maxdepth 1 -type d \( -name "export-config-*" -o -name "database-export-*" \) 2>/dev/null | while read -r d; do
  [ -n "$d" ] && echo "  $d/ ($(du -sh "$d" 2>/dev/null | cut -f1))"
done
echo ""

echo "--- Fichiers .txt à la racine (hors node_modules) ---"
find . -maxdepth 3 -name "*.txt" -not -path "*/node_modules/*" -type f 2>/dev/null | head -30
echo ""

echo "--- Taille des répertoires principaux ---"
du -sh . 2>/dev/null || true
for d in backend dashboard dist node_modules logs; do
  [ -d "$d" ] && echo "  $d: $(du -sh "$d" 2>/dev/null | cut -f1)" || true
done
echo ""

echo "--- Fichiers .log récents (plus de 1 Mo) ---"
find . -name "*.log" -type f -size +1M 2>/dev/null | head -20
echo ""

echo "--- Fin du rapport ---"
'

$SSH_E "$VPS" "APP_DIR=$APP_DIR bash -s" <<< "$REMOTE_SCRIPT" || { echo "Connexion SSH échouée. Utilisez SSHPASS=... pour authentification par mot de passe."; exit 1; }

echo ""
echo "Pour supprimer la documentation uniquement: ./scripts/remove-docs-on-server.sh"
echo "Les dossiers export-* et database-export-* peuvent être supprimés manuellement sur le serveur si inutiles."
