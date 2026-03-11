#!/bin/bash
# Remplace la version hébergée sur le serveur par la version locale :
#   1. Synchronise le code (exclut uploads pour les traiter à part)
#   2. Exporte la base MongoDB locale → envoie sur le serveur → restauration (--drop)
#   3. Synchronise les médias (vidéo, audio, images, HLS) local → serveur
#   4. Sur le serveur : npm install, build, PM2 restart, Nginx reload
#
# Usage:
#   ./scripts/deploy-replace-server-with-local.sh
#   SSHPASS='mot_de_passe' ./scripts/deploy-replace-server-with-local.sh
#
# Variables optionnelles:
#   VPS=user@ip          (défaut: root@187.77.168.205)
#   APP_DIR=/var/www/gnv-app
#   SKIP_DB=1            pour ne pas remplacer la base
#   SKIP_UPLOADS=1       pour ne pas synchroniser les médias
#   SKIP_CODE=1          pour ne pas synchroniser le code
#
# Prérequis:
#   - MongoDB tourne en local (port 27017) pour l'export
#   - ssh + rsync (sshpass optionnel si SSHPASS fourni)

set -e
VPS="${VPS:-root@187.77.168.205}"
APP_DIR="${APP_DIR:-/var/www/gnv-app}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"

if [ -n "$SSHPASS" ]; then
  command -v sshpass &>/dev/null || { echo "Installez sshpass (brew install sshpass / apt install sshpass) pour utiliser SSHPASS"; exit 1; }
  export SSHPASS
  SSH_E="sshpass -e ssh -o StrictHostKeyChecking=no"
  RSYNC_SSH="sshpass -e ssh -o StrictHostKeyChecking=no"
else
  SSH_E="ssh -o StrictHostKeyChecking=no"
  RSYNC_SSH="ssh -o StrictHostKeyChecking=no"
fi

echo "=============================================="
echo "  Remplacement serveur par version locale"
echo "=============================================="
echo "  Source:  $SRC"
echo "  Cible:   $VPS:$APP_DIR"
echo "=============================================="
echo ""

# --- 1. Code ---
if [ -z "$SKIP_CODE" ]; then
  echo "[1/4] Synchronisation du code (exclusion: node_modules, .git, config, uploads)..."
  rsync -avz --delete -e "$RSYNC_SSH" \
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
  echo "      Code synchronisé."
else
  echo "[1/4] SKIP_CODE=1 — code non synchronisé."
fi
echo ""

# --- 2. Base de données ---
if [ -z "$SKIP_DB" ]; then
  echo "[2/4] Base de données : export local → envoi → restauration sur le serveur..."
  if ! command -v mongodump &>/dev/null; then
    echo "      Erreur: mongodump introuvable. Installez MongoDB Database Tools."
    exit 1
  fi
  mkdir -p "$SRC/dump-mongodb"
  echo "      Export local (gnv_onboard)..."
  mongodump --uri="mongodb://localhost:27017" --db=gnv_onboard --out="$SRC/dump-mongodb" 2>&1 || \
    { echo "      Erreur: MongoDB doit tourner en local (port 27017)."; exit 1; }
  echo "      Envoi du dump vers le serveur..."
  $SSH_E "$VPS" "mkdir -p $APP_DIR"
  rsync -avz -e "$RSYNC_SSH" "$SRC/dump-mongodb/" "$VPS:$APP_DIR/dump-mongodb/"
  echo "      Restauration sur le serveur (--drop, remplace l'ancienne base)..."
  $SSH_E "$VPS" "command -v mongorestore &>/dev/null && mongorestore --uri='mongodb://localhost:27017' --db=gnv_onboard --drop $APP_DIR/dump-mongodb/gnv_onboard || { echo 'mongorestore non trouvé sur le serveur'; exit 1; }"
  echo "      Base de données remplacée."
else
  echo "[2/4] SKIP_DB=1 — base de données non modifiée."
fi
echo ""

# --- 3. Médias (vidéo, audio, images, HLS) ---
if [ -z "$SKIP_UPLOADS" ]; then
  echo "[3/4] Synchronisation des médias (vidéo, audio, images, HLS)..."
  UPLOADS_LOCAL="$SRC/backend/public/uploads"
  if [ -d "$UPLOADS_LOCAL" ]; then
    $SSH_E "$VPS" "mkdir -p $APP_DIR/backend/public"
    rsync -avz --delete -e "$RSYNC_SSH" \
      "$UPLOADS_LOCAL/" "$VPS:$APP_DIR/backend/public/uploads/"
    echo "      Médias synchronisés (videos, audio, images, videos_hls)."
  else
    echo "      Dossier $UPLOADS_LOCAL absent, ignoré."
  fi
else
  echo "[3/4] SKIP_UPLOADS=1 — médias non synchronisés."
fi
echo ""

# --- 4. Build et redémarrage sur le serveur ---
echo "[4/4] Sur le serveur : dépendances, build, PM2, Nginx..."
$SSH_E "$VPS" "APP_DIR=$APP_DIR bash $APP_DIR/scripts/update-on-vps-remote.sh"
echo ""

echo "=============================================="
echo "  Déploiement terminé."
echo "  Application : http://${VPS#*@}"
echo "  Dashboard   : http://${VPS#*@}/dashboard/"
echo "=============================================="
