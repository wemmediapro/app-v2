# Installation rapide — GNV OnBoard sur VM Ubuntu 22.04

Guide minimal pour installer l’application sur une **VM Ubuntu 22.04**. Pour les détails (sécurité, HTTPS, PM2, dépannage), voir **[MANUEL-INSTALLATION-UBUNTU-22.04.md](MANUEL-INSTALLATION-UBUNTU-22.04.md)**.

---

## Option A : Installation automatique avec Ansible

Sur votre machine (avec Ansible installé), depuis la **racine du projet** :

```bash
# 1. Configurer l'inventaire : éditer ansible/inventory.yml
#    Remplacer IP_OU_DOMAINE par l'IP de votre VM.

# 2. Configurer les variables : éditer ansible/group_vars/all.yml
#    Au minimum : nginx_server_name (IP ou domaine), admin_password, jwt_secret.

# 3. Lancer le playbook
ansible-playbook -i ansible/inventory.yml ansible/playbook.yml
```

Puis sur la **VM** (en SSH) :

```bash
# PM2 au démarrage (exécuter la commande affichée par Ansible si demandé)
pm2 startup
pm2 save

# Initialiser la base de données
cd /var/www/gnv-app && . ~/.nvm/nvm.sh && cd backend && npm run init-db
```

Accès : `http://IP_DE_LA_VM` (frontend), `http://IP_DE_LA_VM/dashboard/` (dashboard admin si configuré).

---

## Option B : Installation manuelle (copier-coller)

À exécuter **sur la VM** (utilisateur avec `sudo`).

### 1. Mise à jour et paquets de base

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential curl git wget software-properties-common \
  apt-transport-https ca-certificates gnupg lsb-release ufw fail2ban
```

### 2. Node.js 20 (NVM)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm use 20 && nvm alias default 20
node -v
```

### 3. MongoDB (Ubuntu 22.04 : 7.x ; Ubuntu 24.04 : 8.x)

**Ubuntu 22.04 (jammy) — MongoDB 7 :**

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable mongod && sudo systemctl start mongod
```

**Ubuntu 24.04 (noble) — MongoDB 8 :** (recommandé ; MongoDB 7 Enterprise n’est pas disponible pour 24.04)

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable mongod && sudo systemctl start mongod
```

### 4. Redis et Nginx

```bash
sudo apt install -y redis-server nginx
sudo systemctl enable redis-server nginx && sudo systemctl start redis-server nginx
```

### 5. PM2

```bash
npm install -g pm2
```

### 6. Déploiement de l'application

```bash
sudo mkdir -p /var/www/gnv-app && sudo chown "$USER:$USER" /var/www/gnv-app
cd /var/www/gnv-app
# Récupérer le code : git clone <URL> .  OU  copier une archive (tar) depuis votre machine puis tar -xzvf ...
```

Puis :

```bash
cd /var/www/gnv-app
npm ci --omit=dev
cd backend && npm ci --omit=dev && cd ..
cd dashboard && npm ci --omit=dev && cd ..
npm run build && cd dashboard && npm run build && cd ..
```

### 7. Configuration backend

```bash
cp backend/config.production.env.example backend/config.env
nano backend/config.env
```

À adapter au minimum :

- `MONGODB_URI=mongodb://localhost:27017/gnv_onboard?directConnection=true`
- `REDIS_URI=redis://localhost:6379` — **obligatoire** en mode cluster PM2 (Socket.IO)
- `JWT_SECRET=` (une longue chaîne aléatoire)
- `FRONTEND_URL=http://IP_DE_LA_VM` (ou votre domaine)
- `ADMIN_EMAIL` et `ADMIN_PASSWORD`

Créer les dossiers et lancer :

```bash
mkdir -p logs backend/public/uploads/{videos,images,audio,temp}
pm2 start ecosystem.config.cjs --env production
pm2 save && pm2 startup
cd backend && npm run init-db && cd ..
```

### 8. Nginx (site par défaut ou nouveau vhost)

Exemple minimal pour écouter sur le port 80 et proxy vers l'app :

```bash
sudo nano /etc/nginx/sites-available/gnv-app
```

Coller une config du type (remplacer `IP_OU_DOMAINE` par l'IP de la VM) :

```nginx
upstream backend { server 127.0.0.1:3000; keepalive 32; }
upstream frontend { server 127.0.0.1:5173; keepalive 16; }
upstream dashboard { server 127.0.0.1:5174; keepalive 8; }

server {
    listen 80;
    server_name IP_OU_DOMAINE;
    client_max_body_size 50M;

    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 3600s;
    }
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /uploads/ { proxy_pass http://backend; proxy_set_header Host $host; proxy_buffering off; }
    location /dashboard/ { proxy_pass http://dashboard/; proxy_set_header Host $host; }
    location / { proxy_pass http://frontend; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
}
```

Activer et recharger :

```bash
sudo ln -sf /etc/nginx/sites-available/gnv-app /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 9. Pare-feu (optionnel)

```bash
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
```

---

## Vérifications

```bash
pm2 status
curl -s http://localhost:3000/api/health
```

Ouvrir dans un navigateur : **http://IP_DE_LA_VM**

---

## Références

- **Manuel complet** : [MANUEL-INSTALLATION-UBUNTU-22.04.md](MANUEL-INSTALLATION-UBUNTU-22.04.md)
- **Ansible** : [ansible/README-ANSIBLE.md](ansible/README-ANSIBLE.md)
- **Architecture** : [AUDIT-ARCHITECTURE.md](AUDIT-ARCHITECTURE.md)
