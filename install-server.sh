#!/bin/bash

###############################################################################
# Script d'Installation Serveur - GNV OnBoard App
# Configuration pour 2000 connexions simultanées
# Architecture: Serveur Unique (Backend + MongoDB + Redis + Frontend + Nginx)
###############################################################################

set -e  # Arrêt en cas d'erreur

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérification des privilèges root
if [ "$EUID" -ne 0 ]; then 
    print_error "Ce script doit être exécuté en tant que root (sudo)"
    exit 1
fi

print_info "Démarrage de l'installation du serveur..."

# Mise à jour du système
print_info "Mise à jour du système..."
apt update && apt upgrade -y

# Installation des dépendances de base
print_info "Installation des dépendances de base..."
apt install -y \
    build-essential \
    curl \
    git \
    wget \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw \
    fail2ban \
    htop \
    net-tools \
    vim

# Configuration des limites système
print_info "Configuration des limites système..."
cat >> /etc/security/limits.conf << EOF

# Limites pour Node.js - 2000 connexions
* soft nofile 65536
* hard nofile 65536
* soft nproc 32768
* hard nproc 32768
EOF

# Optimisations réseau
print_info "Configuration des optimisations réseau..."
cat >> /etc/sysctl.conf << EOF

# Optimisations réseau pour connexions élevées
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.ip_local_port_range = 10000 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15

# Optimisations mémoire
vm.swappiness = 10
vm.dirty_ratio = 60
vm.dirty_background_ratio = 2
EOF

sysctl -p

# Installation de Node.js via NVM
print_info "Installation de Node.js 20.x LTS..."
if [ ! -d "$HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20

# Vérification de l'installation Node.js
NODE_VERSION=$(node --version)
print_info "Node.js installé: $NODE_VERSION"

# Installation de MongoDB
print_info "Installation de MongoDB 7.0..."
if ! command -v mongod &> /dev/null; then
    wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | apt-key add -
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt update
    apt install -y mongodb-org
    
    # Configuration MongoDB pour serveur unique
    mkdir -p /var/lib/mongodb
    mkdir -p /var/log/mongodb
    chown -R mongodb:mongodb /var/lib/mongodb
    chown -R mongodb:mongodb /var/log/mongodb
    
    # Configuration MongoDB optimisée pour serveur unique
    TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')
    MONGO_CACHE=$((TOTAL_RAM / 2))
    if [ $MONGO_CACHE -gt 32 ]; then
        MONGO_CACHE=32  # Max 32GB pour MongoDB cache
    fi
    
    # Mise à jour de la configuration MongoDB
    sed -i "s/#  cacheSizeGB:/  cacheSizeGB: $MONGO_CACHE/" /etc/mongod.conf 2>/dev/null || true
    
    # Démarrage MongoDB
    systemctl enable mongod
    systemctl start mongod
    
    print_info "MongoDB installé et démarré (Cache: ${MONGO_CACHE}GB)"
else
    print_warning "MongoDB est déjà installé"
fi

# Installation de Redis
print_info "Installation de Redis..."
if ! command -v redis-server &> /dev/null; then
    apt install -y redis-server
    
    # Configuration Redis pour serveur unique
    TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')
    REDIS_MEM=$((TOTAL_RAM / 4))
    if [ $REDIS_MEM -gt 16 ]; then
        REDIS_MEM=16  # Max 16GB pour Redis
    fi
    
    # Configuration Redis
    sed -i "s/^# maxmemory <bytes>/maxmemory ${REDIS_MEM}gb/" /etc/redis/redis.conf
    sed -i 's/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
    sed -i 's/^# appendonly no/appendonly yes/' /etc/redis/redis.conf
    sed -i 's/^bind 127.0.0.1 ::1/bind 127.0.0.1/' /etc/redis/redis.conf
    
    # Démarrage Redis
    systemctl enable redis-server
    systemctl restart redis-server
    
    print_info "Redis installé et démarré (Mémoire: ${REDIS_MEM}GB)"
else
    print_warning "Redis est déjà installé"
fi

# Installation de PM2
print_info "Installation de PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 10M
    pm2 set pm2-logrotate:retain 7
    pm2 set pm2-logrotate:compress true
    
    print_info "PM2 installé avec logrotate"
else
    print_warning "PM2 est déjà installé"
fi

# Installation de Nginx
print_info "Installation de Nginx..."
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
    
    # Configuration de base Nginx
    cat > /etc/nginx/nginx.conf << 'NGINX_EOF'
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Logs
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
    
    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;
    
    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
    
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
NGINX_EOF
    
    systemctl enable nginx
    systemctl restart nginx
    
    print_info "Nginx installé et configuré"
else
    print_warning "Nginx est déjà installé"
fi

# Configuration du firewall
print_info "Configuration du firewall..."
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # Backend (temporaire, à retirer après configuration Nginx)
print_info "Firewall configuré"

# Création du répertoire pour l'application
APP_DIR="/var/www/gnv-app"
print_info "Création du répertoire de l'application: $APP_DIR"
mkdir -p $APP_DIR
mkdir -p $APP_DIR/logs
mkdir -p $APP_DIR/uploads
chown -R $SUDO_USER:$SUDO_USER $APP_DIR

# Installation de Certbot (SSL)
print_info "Installation de Certbot pour SSL..."
apt install -y certbot python3-certbot-nginx

# Résumé de l'installation
print_info "=========================================="
print_info "Installation terminée avec succès!"
print_info "Architecture: Serveur Unique (Tout-en-Un)"
print_info "=========================================="
echo ""
print_info "Versions installées:"
echo "  - Node.js: $(node --version)"
echo "  - npm: $(npm --version)"
echo "  - MongoDB: $(mongod --version 2>/dev/null | head -n 1 || echo 'Installé')"
echo "  - Redis: $(redis-server --version 2>/dev/null | head -n 1 || echo 'Installé')"
echo "  - PM2: $(pm2 --version)"
echo "  - Nginx: $(nginx -v 2>&1)"
echo ""
print_info "Ressources système:"
TOTAL_RAM=$(free -h | awk '/^Mem:/{print $2}')
echo "  - RAM totale: $TOTAL_RAM"
echo "  - MongoDB cache: ~$(($(free -g | awk '/^Mem:/{print $2}') / 2))GB"
echo "  - Redis mémoire: ~$(($(free -g | awk '/^Mem:/{print $2}') / 4))GB"
echo ""
print_warning "Prochaines étapes:"
echo "  1. Copier votre application dans $APP_DIR"
echo "  2. Configurer les variables d'environnement (.env.production)"
echo "  3. Installer les dépendances: cd $APP_DIR && npm install --production"
echo "  4. Builder l'application: npm run build"
echo "  5. Configurer Nginx avec votre domaine"
echo "  6. Obtenir un certificat SSL: certbot --nginx -d votre-domaine.com"
echo "  7. Démarrer avec PM2: pm2 start ecosystem.production.cjs"
echo "  8. Sauvegarder la configuration PM2: pm2 save && pm2 startup"
echo ""
print_info "Consultez SERVER-REQUIREMENTS.md pour plus de détails"
print_info "Architecture: Un seul serveur héberge Backend + MongoDB + Redis + Frontend + Nginx"
