#!/bin/bash
#
# Mise à jour de la version hébergée et optionnellement de la base de données.
#
# Usage:
#   ./scripts/update-hebergement.sh              # Tout : code + base + redémarrage
#   ./scripts/update-hebergement.sh --code-only  # Uniquement code (build + PM2)
#   ./scripts/update-hebergement.sh --db-only   # Uniquement base + médias (depuis le dump local)
#
# Avec mot de passe SSH :
#   SSHPASS='votre_mot_de_passe' ./scripts/update-hebergement.sh
#
# Variables d'environnement :
#   VPS     — Utilisateur@hôte (défaut: root@187.77.168.205)
#   APP_DIR — Répertoire sur le VPS (défaut: /var/www/gnv-app)
#   DB_NAME — Nom de la base MongoDB (défaut: gnv_onboard)
#
set -e

VPS="${VPS:-root@187.77.168.205}"
APP_DIR="${APP_DIR:-/var/www/gnv-app}"
DB_NAME="${DB_NAME:-gnv_onboard}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"

DO_CODE=true
DO_DB=false

for arg in "$@"; do
  case "$arg" in
    --code-only) DO_DB=false; DO_CODE=true ;;
    --db-only)   DO_CODE=false; DO_DB=true ;;
    --full)      DO_CODE=true; DO_DB=true ;;
    -h|--help)
      echo "Usage: $0 [--code-only|--db-only|--full]"
      echo "  --code-only  Mise à jour du code uniquement (sync, build, PM2, Redis, Nginx)"
      echo "  --db-only    Mise à jour de la base uniquement (dump local → VPS + uploads)"
      echo "  --full       Code + base (défaut si aucun argument)"
      echo ""
      echo "Exemple: SSHPASS='secret' $0 --full"
      exit 0
      ;;
  esac
done

# Par défaut : tout (code + base)
if [ "$DO_CODE" = false ] && [ "$DO_DB" = false ]; then
  DO_CODE=true
  DO_DB=true
fi

if [ -n "$SSHPASS" ]; then
  command -v sshpass &>/dev/null || { echo "Installez sshpass (brew install sshpass / apt install sshpass) pour utiliser SSHPASS"; exit 1; }
  export SSHPASS
  SSH_E="sshpass -e ssh -o StrictHostKeyChecking=no"
else
  SSH_E="ssh -o StrictHostKeyChecking=no"
fi

echo "=============================================="
echo "  Mise à jour hébergement — $VPS"
echo "  Répertoire: $APP_DIR"
echo "  Code: $([ "$DO_CODE" = true ] && echo 'oui' || echo 'non') | Base: $([ "$DO_DB" = true ] && echo 'oui' || echo 'non')"
echo "=============================================="
echo ""

# ---- 1. Mise à jour du code (sync + build + restart) ----
if [ "$DO_CODE" = true ]; then
  echo "[Étape 1] Synchronisation des fichiers..."
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
    --exclude 'dump-mongodb' \
    "$SRC/" "$VPS:$APP_DIR/"

  echo ""
  echo "[Étape 2] Build, cache Redis et redémarrage sur le VPS..."
  $SSH_E "$VPS" "APP_DIR=$APP_DIR bash $APP_DIR/scripts/update-on-vps-remote.sh"
  echo ""
fi

# ---- 2. Mise à jour de la base de données (dump local → VPS) ----
if [ "$DO_DB" = true ]; then
  echo "[Base] Export de la base locale ($DB_NAME)..."
  mkdir -p "$SRC/dump-mongodb"
  if ! mongodump --uri="mongodb://localhost:27017" --db="$DB_NAME" --out="$SRC/dump-mongodb" 2>&1; then
    echo "Erreur: MongoDB doit tourner en local (mongod) pour exporter la base."
    echo "Lancez MongoDB puis relancez ce script avec --db-only pour ne mettre à jour que la base."
    exit 1
  fi

  echo ""
  echo "[Base] Envoi du dump sur le VPS..."
  $SSH_E "$VPS" "mkdir -p $APP_DIR/dump-mongodb"
  if [ -n "$SSHPASS" ]; then
    sshpass -e rsync -avz -e "ssh -o StrictHostKeyChecking=no" "$SRC/dump-mongodb/" "$VPS:$APP_DIR/dump-mongodb/"
  else
    rsync -avz -e "ssh -o StrictHostKeyChecking=no" "$SRC/dump-mongodb/" "$VPS:$APP_DIR/dump-mongodb/"
  fi

  echo ""
  echo "[Base] Restauration sur le VPS (remplace la base $DB_NAME)..."
  $SSH_E "$VPS" "mongorestore --uri='mongodb://localhost:27017' --db=$DB_NAME --drop $APP_DIR/dump-mongodb/$DB_NAME"

  echo ""
  echo "[Base] Synchronisation des médias (uploads)..."
  if [ -d "$SRC/backend/public/uploads" ] && [ -n "$(ls -A "$SRC/backend/public/uploads" 2>/dev/null)" ]; then
    if [ -n "$SSHPASS" ]; then
      sshpass -e rsync -avz -e "ssh -o StrictHostKeyChecking=no" "$SRC/backend/public/uploads/" "$VPS:$APP_DIR/backend/public/uploads/" || echo "⚠ Sync uploads interrompu (relancez si besoin)."
    else
      rsync -avz -e "ssh -o StrictHostKeyChecking=no" "$SRC/backend/public/uploads/" "$VPS:$APP_DIR/backend/public/uploads/" || echo "⚠ Sync uploads interrompu (relancez si besoin)."
    fi
  else
    echo "   Pas de dossier backend/public/uploads en local, ignoré."
  fi

  echo ""
  echo "[Base] Redémarrage du backend pour prendre en compte la nouvelle base..."
  $SSH_E "$VPS" "export NVM_DIR=/root/.nvm && [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\" && cd $APP_DIR && pm2 restart gnv-backend 2>/dev/null || true"
  echo ""
fi

echo "=============================================="
echo "  Mise à jour terminée."
echo "  App:       http://${VPS#*@}/"
echo "  Dashboard: http://${VPS#*@}/dashboard/"
echo "=============================================="
