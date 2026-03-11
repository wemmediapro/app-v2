#!/bin/bash
# À exécuter SUR le VPS : nettoie le répertoire de l'app et ne garde que les fichiers
# nécessaires au fonctionnement (code, config, uploads, builds, scripts).
# Usage sur le VPS: APP_DIR=/var/www/gnv-app ./scripts/clean-server-keep-app-only-remote.sh
# Ou depuis la machine locale: SSHPASS='...' ./scripts/clean-server-keep-app-only.sh

set -e
APP_DIR="${APP_DIR:-/var/www/gnv-app}"
cd "$APP_DIR" || { echo "Répertoire $APP_DIR introuvable"; exit 1; }
shopt -s nullglob 2>/dev/null || true

echo "=============================================="
echo "  Nettoyage serveur — garder uniquement l'app"
echo "  Répertoire: $APP_DIR"
echo "=============================================="
echo ""

# 1. Supprimer les dumps MongoDB (souvent volumineux, recréables)
if [ -d "dump-mongodb" ]; then
  echo "[1/6] Suppression dump-mongodb/..."
  rm -rf dump-mongodb
  echo "      dump-mongodb supprimé."
else
  echo "[1/6] Pas de dump-mongodb, ignoré."
fi

# 2. Vider les logs (garder les fichiers pour PM2, mais tronquer)
echo "[2/6] Vidage des fichiers de logs..."
for f in logs/*.log; do
  [ -f "$f" ] && : > "$f" && echo "      vidé: $f"
done
[ -d logs ] || mkdir -p logs
echo "      Logs vidés."

# 3. Supprimer les fichiers temporaires uploads
echo "[3/6] Nettoyage uploads/temp..."
rm -rf backend/public/uploads/temp/* 2>/dev/null
mkdir -p backend/public/uploads/temp
echo "      temp vidé."

# 4. Cache npm (optionnel, libère de l'espace)
echo "[4/6] Nettoyage cache npm..."
npm cache clean --force 2>/dev/null || true
[ -d backend/node_modules/.cache ] && rm -rf backend/node_modules/.cache
[ -d dashboard/node_modules/.cache ] && rm -rf dashboard/node_modules/.cache
[ -d node_modules/.cache ] && rm -rf node_modules/.cache
echo "      Cache npm nettoyé."

# 5. Fichiers ou archives parasites à la racine (hors projet)
echo "[5/6] Suppression fichiers parasites (tar.gz, backup, .bak)..."
find . -maxdepth 2 -type f \( -name "*.tar.gz" -o -name "*.zip" -o -name "*.bak" -o -name "*backup*" \) 2>/dev/null | while read -r f; do
  echo "      supprimé: $f"
  rm -f "$f"
done
echo "      Fini."

# 6. Exports / dossiers d'export locaux (s'ils ont été copiés sur le serveur par erreur)
echo "[6/6] Suppression dossiers export-* à la racine..."
for d in export-config-hebergement-* export-config-vps-online-* export-*; do
  [ -d "$d" ] && rm -rf "$d" && echo "      supprimé: $d"
done
echo "      Fini."

echo ""
echo "=============================================="
echo "  Contenu conservé (lié à l'application):"
echo "  - Code: src/, backend/, dashboard/, public/"
echo "  - Config: backend/config.env, backend/.env"
echo "  - Médias: backend/public/uploads/ (videos, audio, images, videos_hls)"
echo "  - Builds: dist/, dashboard/dist/"
echo "  - PM2: ecosystem.config.cjs, package.json"
echo "  - Scripts: scripts/"
echo "=============================================="
echo "  Nettoyage terminé."
