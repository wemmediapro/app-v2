#!/bin/bash
# Analyse la configuration du serveur d'hébergement (VPS) et génère un rapport YAML
# pour reproduire la même chose sur une VM client via Ansible.
# Usage: ./scripts/analyze-server-config.sh
#        VPS=root@IP ./scripts/analyze-server-config.sh
#        SSHPASS='...' ./scripts/analyze-server-config.sh
# Sortie: ~/Desktop/gnv-app-server-config.yml (et rapport détaillé .txt)

set -e
VPS="${VPS:-root@187.77.168.205}"
OUT_DIR="${OUT_DIR:-$HOME/Desktop}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUT_YAML="$OUT_DIR/gnv-app-server-config.yml"
OUT_REPORT="$OUT_DIR/gnv-app-server-config-$TIMESTAMP.txt"

if [ -n "$SSHPASS" ]; then
  command -v sshpass &>/dev/null || { echo "Installez sshpass (brew install sshpass) pour utiliser SSHPASS"; exit 1; }
  export SSHPASS
  SSH_E="sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10"
else
  SSH_E="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10"
fi

echo "Connexion au serveur: $VPS"
echo "Rapport YAML: $OUT_YAML"
echo "Rapport détaillé: $OUT_REPORT"
echo ""

# Script inline à exécuter sur le serveur pour tout collecter
REMOTE_SCRIPT='
set -e
APP_DIR="${APP_DIR:-/var/www/gnv-app}"
export NVM_DIR="/root/.nvm"

echo "=== SYSTÈME ==="
echo "---"
echo "os_release:"
cat /etc/os-release 2>/dev/null | sed "s/^/  /" || true
echo ""
echo "uname: $(uname -a)"
echo "hostname: $(hostname)"
echo ""

echo "=== PAQUETS APT (sélection) ==="
for pkg in build-essential curl git wget software-properties-common apt-transport-https ca-certificates gnupg lsb-release nginx redis-server mongodb-org; do
  dpkg -l "$pkg" 2>/dev/null | tail -1 || true
done
echo ""

echo "=== NODE / NVM ==="
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  echo "node_version: $(node -v 2>/dev/null || echo non trouvé)"
  echo "npm_version: $(npm -v 2>/dev/null || echo non trouvé)"
  echo "nvm_version: $(nvm -v 2>/dev/null || echo non trouvé)"
else
  echo "nvm: non installé"
fi
echo ""

echo "=== MONGODB ==="
mongod --version 2>/dev/null || echo "mongod: non trouvé"
mongosh --quiet --eval "db.version()" 2>/dev/null || true
systemctl is-active mongod 2>/dev/null || true
echo ""

echo "=== REDIS ==="
redis-server --version 2>/dev/null || true
redis-cli ping 2>/dev/null || true
systemctl is-active redis-server 2>/dev/null || true
echo ""

echo "=== NGINX ==="
nginx -v 2>&1 || true
echo "sites_enabled:"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || true
echo ""
echo "--- contenu gnv-app ---"
cat /etc/nginx/sites-available/gnv-app 2>/dev/null || echo "fichier absent"
echo ""

echo "=== PM2 ==="
pm2 -v 2>/dev/null || echo "pm2: non trouvé"
pm2 jlist 2>/dev/null || true
echo ""

echo "=== SERVICES (systemd) ==="
systemctl list-units --type=service --state=running 2>/dev/null | head -40 || true
echo ""

echo "=== UFW ==="
ufw status verbose 2>/dev/null | head -30 || true
echo ""

echo "=== RÉPERTOIRES APP ==="
ls -la "$APP_DIR" 2>/dev/null || echo "Répertoire $APP_DIR absent"
echo ""
ls -la "$APP_DIR/backend" 2>/dev/null || true
echo ""

echo "=== PORTS ÉCOUTÉS ==="
ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || true
'

# Exécution sur le serveur et capture
if ! $SSH_E "$VPS" "APP_DIR=${APP_DIR:-/var/www/gnv-app} bash -s" <<< "$REMOTE_SCRIPT" > "$OUT_REPORT" 2>&1; then
  echo "Attention: connexion SSH impossible ou erreur lors de l'analyse."
  echo "Vérifiez VPS=$VPS et la clé SSH / SSHPASS."
  echo "Le rapport détaillé peut être vide. Le fichier YAML de référence est tout de même créé."
fi

# Génération du YAML structuré pour Ansible (à partir du rapport + connaissances du install-on-vps-remote.sh)
cat > "$OUT_YAML" << 'YAML_HEADER'
# Configuration serveur GNV App (hébergement) - pour reproduction avec Ansible
# Généré par scripts/analyze-server-config.sh - à utiliser comme référence pour group_vars

# --- Variables à adapter pour la VM client ---
app_dir: "/var/www/gnv-app"
server_ip: "187.77.168.205"   # Remplacer par l'IP de la VM client
server_name: "_"              # ou le nom de domaine

# --- Système cible ---
os:
  - Ubuntu 22.04 (jammy)

# --- Paquets système ---
apt_packages_base:
  - build-essential
  - curl
  - git
  - wget
  - software-properties-common
  - apt-transport-https
  - ca-certificates
  - gnupg
  - lsb-release

# --- Node.js (NVM) ---
nvm_version: "0.40.1"
node_version: "20"

# --- MongoDB ---
mongodb_version: "8.0"
mongodb_repo: "https://www.mongodb.org/static/pgp/server-8.0.asc"
mongodb_list: "https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse"

# --- Redis + Nginx ---
apt_packages_services:
  - redis-server
  - nginx

# --- PM2 (global npm) ---
pm2_global: true

# --- Pare-feu UFW ---
ufw_allow:
  - "22/tcp"
  - "80/tcp"
  - "443/tcp"
ufw_enabled: true

# --- Application ---
backend_port: 3000
backend_workers: "max"
db_name: "gnv_onboard"
redis_uri: "redis://localhost:6379"
YAML_HEADER

echo "Rapport détaillé enregistré: $OUT_REPORT"
echo "Configuration YAML de référence: $OUT_YAML"
echo ""
echo "Prochaine étape: utiliser le playbook Ansible sur le Bureau pour installer la même configuration sur la VM client."
echo "  cd ~/Desktop/ansible-gnv-app-setup && ansible-playbook -i inventory.yml playbook.yml"
exit 0
