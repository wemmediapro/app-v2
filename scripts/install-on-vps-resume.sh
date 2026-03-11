#!/bin/bash
# Reprise de l'installation VPS à partir de Redis/Nginx (étapes 5-9)
# Usage: bash scripts/install-on-vps-resume.sh

set -e
APP_DIR="${APP_DIR:-/var/www/gnv-app}"
VPS_IP="${VPS_IP:-187.77.168.205}"

echo "Attente du verrou apt (peut prendre 1-2 min)..."
while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do sleep 5; done
while fuser /var/lib/dpkg/lock >/dev/null 2>&1; do sleep 5; done

echo "[5/9] Redis et Nginx..."
apt-get install -y -qq redis-server nginx
systemctl enable redis-server nginx
systemctl start redis-server 2>/dev/null || true
systemctl start nginx 2>/dev/null || true
redis-cli ping | grep -q PONG && echo "Redis OK"

echo "[6/9] PM2..."
export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm install -g pm2 --silent 2>/dev/null || npm install -g pm2

echo "[7/9] Application dans $APP_DIR..."
cd "$APP_DIR"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
# Installer avec devDependencies pour pouvoir builder (vite, etc.)
npm ci 2>/dev/null || npm install
cd backend && npm ci --omit=dev 2>/dev/null || npm install --production && cd ..
cd dashboard && (npm ci 2>/dev/null || npm install) && cd ..
npm run build
cd dashboard && npm run build && cd ..
# Optionnel: supprimer les devDeps après build pour économiser l'espace
# npm prune --production

echo "[8/9] Configuration backend..."
if [ ! -f backend/config.env ]; then
  JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
  cat > backend/config.env << EOF
NODE_ENV=production
PORT=3000
CLUSTER_WORKERS=max
MONGODB_URI=mongodb://localhost:27017/gnv_onboard?directConnection=true
DB_NAME=gnv_onboard
REDIS_URI=redis://localhost:6379
JWT_SECRET=$JWT_SECRET
JWT_EXPIRE=7d
FRONTEND_URL=http://$VPS_IP,http://187.77.168.205
ADMIN_EMAIL=admin@gnv.com
ADMIN_PASSWORD=Changez-moi-dans-config-env
DEMO_MODE=false
EOF
  echo "config.env créé"
else
  echo "config.env existe déjà"
fi
mkdir -p logs backend/public/uploads/{videos,images,audio,temp}

echo "[9/9] PM2 et Nginx..."
pm2 delete all 2>/dev/null || true
cd "$APP_DIR" && pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

cat > /etc/nginx/sites-available/gnv-app << 'NGINX'
upstream backend { server 127.0.0.1:3000; keepalive 32; }
upstream frontend { server 127.0.0.1:5173; keepalive 16; }
upstream dashboard { server 127.0.0.1:5174; keepalive 8; }

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
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
    location /dashboard/ { proxy_pass http://dashboard; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
    location / { proxy_pass http://frontend; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
}
NGINX
ln -sf /etc/nginx/sites-available/gnv-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl reload nginx

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable 2>/dev/null || true

echo ""
echo "=== Installation terminée ==="
echo "Frontend: http://$VPS_IP"
echo "API: http://$VPS_IP/api/health"
echo "Dashboard: http://$VPS_IP/dashboard/"
