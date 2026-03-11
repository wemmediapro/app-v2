#!/bin/bash
# Récupère la configuration actuelle du VPS en ligne (Nginx, config backend, PM2)
# et l'enregistre dans un dossier local daté.
#
# Usage:
#   ./scripts/export-config-vps-online.sh
#   SSHPASS='mot_de_passe' ./scripts/export-config-vps-online.sh
#
# Variables: VPS=user@ip  APP_DIR=/var/www/gnv-app

set -e
VPS="${VPS:-root@187.77.168.205}"
APP_DIR="${APP_DIR:-/var/www/gnv-app}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP=$(date +"%Y%m%d_%H%M")
DEST="$SRC/export-config-vps-online-$TIMESTAMP"

if [ -n "$SSHPASS" ]; then
  command -v sshpass &>/dev/null || { echo "Installez sshpass pour utiliser SSHPASS"; exit 1; }
  export SSHPASS
  SSH_E="sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10"
  SCP_E="sshpass -e scp -o StrictHostKeyChecking=no -o ConnectTimeout=10"
else
  SSH_E="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10"
  SCP_E="scp -o StrictHostKeyChecking=no -o ConnectTimeout=10"
fi

echo "=============================================="
echo "  Export config VPS en ligne → $DEST"
echo "=============================================="
echo "  Serveur: $VPS"
echo "  App:     $APP_DIR"
echo "=============================================="
echo ""

mkdir -p "$DEST"

# Test connexion
if ! $SSH_E "$VPS" "exit" 2>/dev/null; then
  echo "❌ Connexion SSH impossible vers $VPS"
  echo "   Vérifiez IP, utilisateur et mot de passe (ou SSHPASS)."
  exit 1
fi

echo "[1/5] Nginx (sites-available/gnv-app)..."
$SSH_E "$VPS" "cat /etc/nginx/sites-available/gnv-app 2>/dev/null || cat /etc/nginx/sites-enabled/gnv-app 2>/dev/null" > "$DEST/nginx-gnv-app.conf" 2>/dev/null || echo "# Fichier non trouvé sur le VPS" > "$DEST/nginx-gnv-app.conf"
echo "      → nginx-gnv-app.conf"

echo "[2/5] Backend config.env (valeurs masquées)..."
$SSH_E "$VPS" "grep -E '^[A-Z_]+=' $APP_DIR/backend/config.env 2>/dev/null | sed 's/=.*/=***/' || true" > "$DEST/config.env.masked" 2>/dev/null || true
if [ ! -s "$DEST/config.env.masked" ]; then
  echo "# config.env non trouvé ou vide sur le VPS" > "$DEST/config.env.masked"
fi
echo "      → config.env.masked"

echo "[3/5] PM2 ecosystem..."
$SSH_E "$VPS" "cat $APP_DIR/ecosystem.config.cjs 2>/dev/null" > "$DEST/ecosystem.config.cjs" 2>/dev/null || echo "// Non trouvé" > "$DEST/ecosystem.config.cjs"
$SSH_E "$VPS" "cat $APP_DIR/ecosystem.production.cjs 2>/dev/null" > "$DEST/ecosystem.production.cjs" 2>/dev/null || true
echo "      → ecosystem.config.cjs (+ .production.cjs si présent)"

echo "[4/5] État PM2 et versions..."
$SSH_E "$VPS" "export NVM_DIR=/root/.nvm 2>/dev/null; [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"; cd $APP_DIR 2>/dev/null; pm2 list 2>/dev/null; echo '---'; node -v 2>/dev/null; echo '---'; nginx -v 2>&1" > "$DEST/pm2-et-versions.txt" 2>/dev/null || true
echo "      → pm2-et-versions.txt"

echo "[5/5] Infos serveur (répertoires, ports)..."
$SSH_E "$VPS" "echo '=== APP_DIR ==='; ls -la $APP_DIR 2>/dev/null | head -25; echo ''; echo '=== backend ==='; ls -la $APP_DIR/backend 2>/dev/null | head -15; echo ''; echo '=== Ports en écoute ==='; ss -tlnp 2>/dev/null | grep -E '3000|5173|5174|80|27017|6379' || netstat -tlnp 2>/dev/null | grep -E '3000|5173|5174|80|27017|6379' || true" > "$DEST/serveur-infos.txt" 2>/dev/null || true
echo "      → serveur-infos.txt"

# Résumé
cat > "$DEST/README.md" << README
# Configuration VPS en ligne — export $TIMESTAMP

Récupérée depuis **$VPS** (répertoire $APP_DIR).

## Fichiers

| Fichier | Description |
|---------|-------------|
| **nginx-gnv-app.conf** | Config Nginx telle que sur le serveur |
| **config.env.masked** | Noms des variables backend (valeurs masquées ***) |
| **ecosystem.config.cjs** | Config PM2 utilisée sur le VPS |
| **ecosystem.production.cjs** | Config PM2 production (si présente) |
| **pm2-et-versions.txt** | Sortie \`pm2 list\`, Node, Nginx |
| **serveur-infos.txt** | Arborescence et ports en écoute |

## Réappliquer cette config Nginx

\`\`\`bash
sudo cp nginx-gnv-app.conf /etc/nginx/sites-available/gnv-app
sudo nginx -t && sudo systemctl reload nginx
\`\`\`
README

echo ""
echo "=============================================="
echo "  ✅ Export terminé: $DEST"
echo "=============================================="
ls -la "$DEST"
