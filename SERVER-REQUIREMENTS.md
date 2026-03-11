# Configuration Serveur Requise - 2000 Connexions Simultanées

## 📋 Vue d'ensemble

Ce document décrit les spécifications matérielles (hardware) et logicielles (software) requises pour faire fonctionner l'application GNV OnBoard avec **2000 connexions simultanées** en **production**.

> **Note**: Pour les exigences de développement, consultez [REQUIREMENTS-DEVELOPMENT.md](./REQUIREMENTS-DEVELOPMENT.md)

## 🎯 Environnements

- **[Développement](./REQUIREMENTS-DEVELOPMENT.md)** : Configuration minimale pour développement local
- **Staging** : Configuration intermédiaire pour tests
- **Production** : Configuration complète pour 2000+ connexions simultanées (ce document)

---

## 🖥️ SPÉCIFICATIONS HARDWARE

### Configuration Serveur Unique (Tout-en-Un)

**Architecture**: Un seul serveur hébergeant Backend, MongoDB, Redis, Frontend et Nginx

#### **Configuration Minimale Recommandée**

| Composant | Spécification | Justification |
|-----------|---------------|---------------|
| **CPU** | 12-16 cœurs (3.0+ GHz) | PM2 clustering + MongoDB + Redis nécessitent plusieurs cœurs |
| **RAM** | 32-48 GB | Répartition: ~16GB MongoDB, ~8GB Redis, ~8GB Node.js/PM2, ~8GB système |
| **Disque** | 1 TB SSD (NVMe recommandé) | Base de données MongoDB + logs + fichiers uploadés + OS |
| **Réseau** | 1 Gbps (minimum) | 2000 connexions simultanées nécessitent une bande passante élevée |
| **Connexions** | 10,000+ connexions TCP simultanées | Support des connexions Socket.io |

**Répartition Mémoire Recommandée**:
- MongoDB: 16 GB (cache WiredTiger)
- Redis: 8 GB (maxmemory)
- Node.js/PM2: 8 GB (clustering)
- Système OS: 4 GB
- Buffer: 4 GB

#### **Configuration Optimale (Production)**

| Composant | Spécification | Justification |
|-----------|---------------|---------------|
| **CPU** | 16-24 cœurs (3.5+ GHz) | AMD EPYC ou Intel Xeon pour meilleures performances |
| **RAM** | 64-96 GB DDR4/DDR5 ECC | Plus de RAM = meilleur cache MongoDB et Redis |
| **Disque** | 2 TB NVMe SSD | RAID 1 pour redondance (recommandé) |
| **Réseau** | 10 Gbps | Support de 50,000+ connexions simultanées |

**Répartition Mémoire Optimale**:
- MongoDB: 32 GB (cache WiredTiger)
- Redis: 16 GB (maxmemory)
- Node.js/PM2: 16 GB (clustering)
- Système OS: 8 GB
- Buffer: 8 GB

---

## 💻 SPÉCIFICATIONS SOFTWARE

### Système d'Exploitation

#### **Option 1: Linux (Recommandé)**

```bash
# Ubuntu Server 22.04 LTS ou 24.04 LTS
# Sous Ubuntu 24.04, utiliser MongoDB 8.x (support officiel). Sous 22.04 : MongoDB 7.x ou 8.x.
- Kernel: Linux 5.15+ ou 6.2+
- Architecture: x86_64 (64-bit)
- Support: Long Term Support (LTS) pour stabilité
```

**Alternatives acceptables:**
- Debian 12 (Bookworm)
- CentOS Stream 9
- RHEL 9

#### **Option 2: Cloud Providers**

- **AWS**: EC2 instances (c6i.4xlarge ou supérieur)
- **Google Cloud**: Compute Engine (n2-standard-8 ou supérieur)
- **Azure**: Virtual Machines (Standard_D8s_v3 ou supérieur)
- **DigitalOcean**: Droplets (16 GB RAM / 8 vCPU minimum)

### Stack Logicielle

#### **1. Node.js**

```bash
Version: Node.js 20.x LTS (ou 22.x)
Installation: Via nvm (Node Version Manager)
Commande: nvm install 20 && nvm use 20
```

**Justification**: Support des dernières fonctionnalités ES6+, meilleures performances

#### **2. PM2 (Process Manager)**

```bash
Version: PM2 5.x ou supérieur
Installation: npm install -g pm2
Commande: pm2 --version
```

**Configuration**: 
- Mode cluster avec `max` instances (utilise tous les cœurs CPU)
- Auto-restart activé
- Logs rotatifs

#### **3. MongoDB**

```bash
Version: MongoDB 7.0+ (22.04) ou 8.0+ (recommandé pour 24.04)
Installation: Via package manager officiel
Architecture: Replica Set (recommandé pour production)
```

**Configuration minimale**:
- WiredTiger Storage Engine
- Journal activé
- Index optimisés
- Connection pool: 100-200 connexions

**Fichier de configuration MongoDB** (`/etc/mongod.conf`):
```yaml
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true
  wiredTiger:
    engineConfig:
      cacheSizeGB: 16  # Ajuster selon RAM disponible (50% max recommandé)
      journalCompressor: snappy
      directoryForIndexes: false

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
  logRotate: reopen

net:
  port: 27017
  bindIp: 127.0.0.1  # Localhost uniquement sur serveur unique
  maxIncomingConnections: 2000

processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod.pid

# Pas de Replica Set nécessaire pour serveur unique
# replication:
#   replSetName: "rs0"
```

#### **4. Redis**

```bash
Version: Redis 7.2+ (ou 8.0)
Installation: Via package manager ou compilation
Port: 6379 (par défaut)
```

**Configuration Redis** (`/etc/redis/redis.conf`):
```conf
# Mémoire (ajuster selon RAM disponible)
maxmemory 8gb
maxmemory-policy allkeys-lru

# Persistance
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec

# Réseau (localhost uniquement sur serveur unique)
bind 127.0.0.1
tcp-backlog 511
timeout 0
tcp-keepalive 300
maxclients 10000

# Performance
hz 10
```

#### **5. Nginx (Reverse Proxy / Load Balancer)**

```bash
Version: Nginx 1.24+ ou 1.26+
Installation: Via package manager
```

**Configuration Nginx** (`/etc/nginx/sites-available/gnv-app`):
```nginx
# Backend - PM2 gère le clustering, Nginx pointe vers le port principal
upstream backend {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Frontend
upstream frontend {
    server 127.0.0.1:5173;
    keepalive 16;
}

server {
    listen 80;
    listen [::]:80;
    server_name votre-domaine.com;

    # Limites de connexion
    limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;
    limit_conn conn_limit_per_ip 20;

    # Limites de requêtes
    limit_req_zone $binary_remote_addr zone=req_limit_per_ip:10m rate=10r/s;
    limit_req zone=req_limit_per_ip burst=20 nodelay;

    # Taille maximale des uploads
    client_max_body_size 50M;
    client_body_buffer_size 128k;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # WebSocket pour Socket.io
    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts pour WebSocket
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
}
```

#### **6. Certificat SSL/TLS**

```bash
# Let's Encrypt avec Certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```

---

## 🔧 CONFIGURATION SYSTÈME

### Limites Système (ulimit)

**Fichier**: `/etc/security/limits.conf`
```conf
# Limites pour l'utilisateur Node.js
* soft nofile 65536
* hard nofile 65536
* soft nproc 32768
* hard nproc 32768
```

**Fichier**: `/etc/sysctl.conf`
```conf
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
```

**Application des modifications**:
```bash
sudo sysctl -p
```

### Variables d'Environnement

**Fichier**: `.env.production`
```env
# Application
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://votre-domaine.com

# MongoDB (localhost sur serveur unique)
MONGODB_URI=mongodb://localhost:27017/gnv_app?maxPoolSize=200&minPoolSize=10

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=votre-mot-de-passe-securise

# JWT
JWT_SECRET=votre-secret-jwt-tres-long-et-securise
JWT_EXPIRES_IN=7d

# Socket.io
SOCKET_IO_PING_INTERVAL=10000
SOCKET_IO_PING_TIMEOUT=5000
SOCKET_IO_MAX_HTTP_BUFFER_SIZE=1e6

# PM2
CLUSTER_WORKERS=max
PM2_INSTANCES=max

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Uploads
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/var/www/gnv-app/uploads
```

---

## 📊 MONITORING & LOGGING

### Outils Recommandés

1. **PM2 Monitoring**
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 7
   ```

2. **MongoDB Monitoring**
   - MongoDB Compass (GUI)
   - mongostat / mongotop (CLI)
   - MongoDB Atlas Monitoring (si cloud)

3. **Redis Monitoring**
   ```bash
   redis-cli --latency
   redis-cli INFO stats
   ```

4. **System Monitoring**
   - **htop** / **top**: Monitoring CPU/RAM
   - **iotop**: Monitoring disque
   - **iftop**: Monitoring réseau
   - **netstat**: Connexions réseau

5. **Application Monitoring**
   - **PM2 Plus** (monitoring cloud)
   - **New Relic** / **Datadog** (APM)
   - **Grafana** + **Prometheus** (métriques)

---

## 🚀 DÉPLOIEMENT

### Checklist de Déploiement

- [ ] Serveur configuré avec spécifications hardware requises
- [ ] OS installé et mis à jour
- [ ] Node.js 20.x installé
- [ ] MongoDB installé et configuré
- [ ] Redis installé et configuré
- [ ] PM2 installé globalement
- [ ] Nginx installé et configuré
- [ ] Certificat SSL/TLS installé
- [ ] Variables d'environnement configurées
- [ ] Limites système configurées (ulimit)
- [ ] Firewall configuré (ports 80, 443, 27017, 6379)
- [ ] Monitoring configuré
- [ ] Backups automatiques configurés
- [ ] Tests de charge effectués

### Commandes de Déploiement

```bash
# 1. Installation des dépendances système
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential curl git nginx

# 2. Installation Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# 3. Installation MongoDB
# Ubuntu 24.04 (noble) — MongoDB 8.x :
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
# Ubuntu 22.04 (jammy) : remplacer noble par jammy dans la ligne echo ci-dessus (MongoDB 7 ou 8)
sudo apt update
sudo apt install -y mongodb-org

# 4. Installation Redis
sudo apt install -y redis-server

# 5. Installation PM2
npm install -g pm2

# 6. Configuration du projet
cd /var/www/gnv-app
npm install --production
npm run build

# 7. Démarrage avec PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup

# 8. Configuration Nginx
sudo cp nginx.conf /etc/nginx/sites-available/gnv-app
sudo ln -s /etc/nginx/sites-available/gnv-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 📈 TESTS DE CHARGE

### Outils de Test

1. **Artillery.js** (recommandé)
   ```bash
   npm install -g artillery
   artillery quick --count 2000 --num 10 http://localhost:3000
   ```

2. **Apache Bench (ab)**
   ```bash
   ab -n 10000 -c 2000 http://localhost:3000/
   ```

3. **wrk**
   ```bash
   wrk -t12 -c2000 -d30s http://localhost:3000/
   ```

### Scénarios de Test

1. **Test de connexions Socket.io**
   - 2000 connexions simultanées
   - Envoi de messages toutes les 5 secondes
   - Durée: 10 minutes

2. **Test de charge API**
   - 2000 requêtes/seconde
   - Endpoints variés
   - Durée: 5 minutes

3. **Test de stress**
   - Augmentation progressive jusqu'à 3000 connexions
   - Monitoring des performances

---

## 🔒 SÉCURITÉ

### Recommandations

1. **Firewall (UFW)**
   ```bash
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 80/tcp    # HTTP
   sudo ufw allow 443/tcp   # HTTPS
   sudo ufw enable
   ```

2. **Fail2Ban**
   ```bash
   sudo apt install fail2ban
   ```

3. **Mises à jour automatiques**
   ```bash
   sudo apt install unattended-upgrades
   ```

4. **Sécurité MongoDB**
   - Authentification activée
   - Accès réseau restreint
   - Chiffrement des données sensibles

5. **Sécurité Redis**
   - Mot de passe configuré
   - Accès réseau restreint
   - Binding sur localhost uniquement

---

## 📝 NOTES IMPORTANTES

1. **Architecture Serveur Unique**: Cette configuration utilise un seul serveur pour toutes les composantes. Pour dépasser 2000 connexions ou améliorer la disponibilité, considérer une architecture distribuée.

2. **Scalabilité**: Pour dépasser 2000 connexions, options possibles:
   - Améliorer les spécifications hardware (plus de RAM/CPU)
   - Ajouter un load balancer avec plusieurs serveurs backend
   - Séparer MongoDB et Redis sur des serveurs dédiés

3. **Haute Disponibilité**: Sur serveur unique, pas de redondance. Pour production critique:
   - Configurer MongoDB Replica Set (nécessite plusieurs serveurs)
   - Utiliser Redis Sentinel pour failover
   - Mettre en place un serveur de backup

4. **Backups**: Configurer des backups automatiques quotidiens de MongoDB et Redis

5. **Logs**: Centraliser les logs avec ELK Stack ou équivalent

6. **CDN**: Utiliser un CDN pour servir les assets statiques (images, CSS, JS) et réduire la charge sur le serveur

7. **Monitoring**: Surveiller régulièrement l'utilisation CPU, RAM et disque pour détecter les goulots d'étranglement

---

## 📞 SUPPORT

Pour toute question concernant cette configuration, consulter la documentation du projet ou contacter l'équipe de développement.

**Dernière mise à jour**: 2024
