#!/bin/bash
# Déploie l'application sur le VPS puis lance l'installation.
# Inclut l'export de la dernière base de données locale et sa restauration sur le serveur.
# Usage: ./scripts/deploy-to-vps.sh
# Ou avec mot de passe (évite de le taper 2 fois): SSHPASS='votre_mot_de_passe' ./scripts/deploy-to-vps.sh

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

# Charger l'URI MongoDB depuis le backend (config.env ou .env)
MONGODB_URI="mongodb://localhost:27017/gnv_onboard?directConnection=true"
DB_NAME="gnv_onboard"
for envfile in "$SRC/backend/config.env" "$SRC/backend/.env"; do
  if [ -f "$envfile" ]; then
    val=$(grep -E '^(MONGODB_URI|DATABASE_URL)=' "$envfile" 2>/dev/null | head -1 | cut -d= -f2- | sed -e "s/^['\"]//" -e "s/['\"]$//")
    [ -n "$val" ] && MONGODB_URI="$val" && break
  fi
done
# Extraire le nom de la base depuis l'URI si possible
if [[ "$MONGODB_URI" =~ /([a-zA-Z0-9_-]+)(\?|$) ]]; then DB_NAME="${BASH_REMATCH[1]}"; fi

echo "[1/5] Export de la base de données locale (dernière version)..."
DUMP_DIR="$SRC/dump-mongodb"
rm -rf "$DUMP_DIR"
if command -v mongodump &>/dev/null; then
  if mongodump --uri="$MONGODB_URI" --out="$DUMP_DIR" 2>/dev/null; then
    echo "    Base $DB_NAME exportée dans dump-mongodb/"
  else
    echo "    Attention: export MongoDB échoué (MongoDB local démarré ?). Déploiement sans mise à jour de la base."
    rm -rf "$DUMP_DIR"
  fi
else
  echo "    mongodump non trouvé. Installez MongoDB Tools. Déploiement sans export de la base."
  rm -rf "$DUMP_DIR"
fi

echo "[2/5] Création du répertoire sur le VPS..."
$SSH_E "$VPS" "mkdir -p $APP_DIR" || { echo "Connexion SSH échouée. Vérifiez IP/mot de passe."; exit 1; }

echo "[3/5] Synchronisation du code (exclusion node_modules, .git, documentation) — uploads et dump DB inclus..."
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
  --exclude '*.md' \
  --exclude 'docs/' \
  --exclude 'backend/docs/' \
  "$SRC/" "$VPS:$APP_DIR/"

echo "[4/5] Exécution du script d'installation sur le VPS..."
$SSH_E "$VPS" "VPS_IP=187.77.168.205 APP_DIR=$APP_DIR bash $APP_DIR/scripts/install-on-vps-remote.sh"

echo "[5/5] Import de la base de données sur le serveur..."
$SSH_E "$VPS" "APP_DIR=$APP_DIR bash $APP_DIR/scripts/import-database-vps.sh"

echo ""
echo "Déploiement terminé. Ouvrez: http://187.77.168.205"
