#!/bin/bash
# Déploie l'application sur le VPS 187.77.168.205 SANS les fichiers média,
# et configure le serveur pour le domaine travelstream.fr.
#
# Usage:
#   SSHPASS='votre_mot_de_passe' ./scripts/deploy-travelstream-vps.sh
#   ou créez .vps-pass à la racine du projet (contenu = mot de passe seul, chmod 600)
#   puis: ./scripts/deploy-travelstream-vps.sh
#
# Prérequis: sshpass (brew install sshpass ou apt install sshpass)

set -e
VPS="${VPS:-root@187.77.168.205}"
APP_DIR="${APP_DIR:-/var/www/gnv-app}"
DOMAIN="${DOMAIN:-travelstream.fr}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"

# Mot de passe SSH : variable SSHPASS ou fichier .vps-pass (non versionné)
if [ -z "$SSHPASS" ] && [ -f "$SRC/.vps-pass" ]; then
  export SSHPASS="$(cat "$SRC/.vps-pass")"
fi
if [ -z "$SSHPASS" ]; then
  echo "Erreur: fournissez le mot de passe SSH par SSHPASS='...' ou en créant $SRC/.vps-pass"
  echo "Exemple: SSHPASS='votre_mot_de_passe' $0"
  exit 1
fi

command -v sshpass &>/dev/null || { echo "Installez sshpass: brew install sshpass (macOS) ou apt install sshpass (Linux)"; exit 1; }
SSH_E="sshpass -e ssh -o StrictHostKeyChecking=no"
RSYNC_SSH="sshpass -e ssh -o StrictHostKeyChecking=no"

echo "=============================================="
echo "  Déploiement VPS → $DOMAIN (sans médias)"
echo "=============================================="
echo "  Source:  $SRC"
echo "  Cible:   $VPS:$APP_DIR"
echo "  Domaine: $DOMAIN www.$DOMAIN"
echo "=============================================="
echo ""

echo "[1/5] Connexion et création du répertoire sur le VPS..."
$SSH_E "$VPS" "mkdir -p $APP_DIR" || { echo "Connexion SSH échouée. Vérifiez IP et mot de passe."; exit 1; }

echo "[2/5] Synchronisation du code (exclusion: node_modules, .git, uploads/médias, config.env)..."
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
  --exclude 'dashboard/public/uploads' \
  --exclude 'dump-mongodb' \
  "$SRC/" "$VPS:$APP_DIR/"
echo "      Code synchronisé (médias non envoyés)."

echo "[3/5] Configuration Nginx pour $DOMAIN..."
$SSH_E "$VPS" "cp -f $APP_DIR/nginx.conf /etc/nginx/sites-available/gnv-app && ln -sf /etc/nginx/sites-available/gnv-app /etc/nginx/sites-enabled/ && rm -f /etc/nginx/sites-enabled/default 2>/dev/null; nginx -t && systemctl reload nginx" || echo "      Nginx: vérifiez /etc/nginx/sites-available/gnv-app"

echo "[4/5] Mise à jour des variables backend pour le domaine..."
$SSH_E "$VPS" "APP_DIR=$APP_DIR DOMAIN=$DOMAIN bash -s" << 'REMOTE_SCRIPT'
ENV_FILE="$APP_DIR/backend/config.env"
mkdir -p "$(dirname "$ENV_FILE")"
[ ! -f "$ENV_FILE" ] && touch "$ENV_FILE"
# FRONTEND_URL pour CORS
if grep -q '^FRONTEND_URL=' "$ENV_FILE" 2>/dev/null; then
  sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://$DOMAIN,https://www.$DOMAIN,http://$DOMAIN,http://www.$DOMAIN|" "$ENV_FILE"
else
  echo "FRONTEND_URL=https://$DOMAIN,https://www.$DOMAIN,http://$DOMAIN,http://www.$DOMAIN" >> "$ENV_FILE"
fi
# API_BASE_URL pour les liens médias
if grep -q '^API_BASE_URL=' "$ENV_FILE" 2>/dev/null; then
  sed -i "s|^API_BASE_URL=.*|API_BASE_URL=https://$DOMAIN|" "$ENV_FILE"
else
  echo "API_BASE_URL=https://$DOMAIN" >> "$ENV_FILE"
fi
# S'assurer que les dossiers uploads existent (vides)
mkdir -p "$APP_DIR/backend/public/uploads/videos" "$APP_DIR/backend/public/uploads/images" "$APP_DIR/backend/public/uploads/audio" "$APP_DIR/backend/public/uploads/temp"
echo "      config.env mis à jour pour $DOMAIN"
REMOTE_SCRIPT

echo "[5/5] Sur le serveur : dépendances, build, PM2, Nginx..."
$SSH_E "$VPS" "APP_DIR=$APP_DIR bash $APP_DIR/scripts/update-on-vps-remote.sh"

echo ""
echo "=============================================="
echo "  Déploiement terminé."
echo "  Application : https://$DOMAIN"
echo "  Dashboard   : https://$DOMAIN/dashboard/"
echo "  API health  : https://$DOMAIN/api/health"
echo "=============================================="
echo ""
echo "Pour activer HTTPS (Let's Encrypt) sur le VPS :"
echo "  ssh $VPS 'apt install -y certbot python3-certbot-nginx && certbot --nginx -d $DOMAIN -d www.$DOMAIN'"
