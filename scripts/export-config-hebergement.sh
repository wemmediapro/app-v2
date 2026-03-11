#!/bin/bash
# Exporte la configuration du serveur d'hébergement dans un dossier daté.
# Usage: ./scripts/export-config-hebergement.sh
# Sortie: export-config-hebergement-YYYYMMDD_HHMM/ avec nginx, PM2, config exemples, Ansible.

set -e
SRC="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP=$(date +"%Y%m%d_%H%M")
DEST="$SRC/export-config-hebergement-$TIMESTAMP"

echo "Export de la configuration d'hébergement vers: $DEST"
mkdir -p "$DEST"
mkdir -p "$DEST/ansible/roles/nginx/templates"
mkdir -p "$DEST/ansible/roles/nginx/tasks"
mkdir -p "$DEST/ansible/roles/nginx/handlers"
mkdir -p "$DEST/ansible/roles/app/templates"

# Nginx
cp "$SRC/nginx.conf" "$DEST/nginx-gnv-app.conf"
[ -f "$SRC/nginx-streaming.conf.example" ] && cp "$SRC/nginx-streaming.conf.example" "$DEST/"

# PM2
[ -f "$SRC/ecosystem.config.cjs" ] && cp "$SRC/ecosystem.config.cjs" "$DEST/"
[ -f "$SRC/ecosystem.production.cjs" ] && cp "$SRC/ecosystem.production.cjs" "$DEST/"

# Config backend (exemples sans secrets)
[ -f "$SRC/backend/config.production.env.example" ] && cp "$SRC/backend/config.production.env.example" "$DEST/config.env.example"

# Ansible
[ -f "$SRC/ansible/group_vars/all.yml" ] && cp "$SRC/ansible/group_vars/all.yml" "$DEST/ansible/"
[ -f "$SRC/ansible/roles/nginx/templates/gnv-app.conf.j2" ] && cp "$SRC/ansible/roles/nginx/templates/gnv-app.conf.j2" "$DEST/ansible/roles/nginx/templates/"
[ -f "$SRC/ansible/roles/nginx/tasks/main.yml" ] && cp "$SRC/ansible/roles/nginx/tasks/main.yml" "$DEST/ansible/roles/nginx/tasks/"
[ -f "$SRC/ansible/roles/nginx/handlers/main.yml" ] && cp "$SRC/ansible/roles/nginx/handlers/main.yml" "$DEST/ansible/roles/nginx/handlers/"
[ -f "$SRC/ansible/roles/app/templates/backend_config.env.j2" ] && cp "$SRC/ansible/roles/app/templates/backend_config.env.j2" "$DEST/ansible/roles/app/templates/"

# Docker (optionnel)
[ -f "$SRC/docker-compose.yml" ] && cp "$SRC/docker-compose.yml" "$DEST/"

# README récapitulatif
cat > "$DEST/README-CONFIG-HEBERGEMENT.md" << 'README'
# Configuration serveur d'hébergement — GNV OnBoard

Export daté de la configuration utilisée pour héberger l'application.

## Contenu

| Fichier | Rôle |
|---------|------|
| **nginx-gnv-app.conf** | Site Nginx (proxy backend, frontend, dashboard, uploads, WebSocket). À copier dans `/etc/nginx/sites-available/gnv-app`. |
| **nginx-streaming.conf.example** | Exemple avancé : Nginx sert `/uploads/` en statique (alias). |
| **ecosystem.config.cjs** | PM2 : backend (cluster), frontend (Vite preview 5173), dashboard (5174). |
| **ecosystem.production.cjs** | Variante PM2 production (si utilisée). |
| **config.env.example** | Variables d'environnement backend. Copier en `backend/config.env` sur le serveur et remplir (MONGODB_URI, JWT_SECRET, etc.). |
| **ansible/** | Rôles Ansible (nginx, app) et variables (group_vars/all.yml) pour déploiement automatisé. |
| **docker-compose.yml** | MongoDB + Redis en conteneurs (optionnel sur le serveur). |

## Chemins par défaut

- **Application** : `/var/www/gnv-app`
- **Nginx site** : `/etc/nginx/sites-available/gnv-app` → lien dans `sites-enabled/`
- **Config backend** : `/var/www/gnv-app/backend/config.env`
- **Logs PM2** : `/var/www/gnv-app/logs/`

## Commandes utiles sur le serveur

```bash
# Activer le site Nginx
sudo ln -sf /etc/nginx/sites-available/gnv-app /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Démarrer / redémarrer l'app (depuis /var/www/gnv-app)
pm2 start ecosystem.config.cjs --env production
pm2 restart ecosystem.config.cjs --env production
pm2 save
```

## Variables à personnaliser

- **Nginx** : `server_name` dans `nginx-gnv-app.conf` (domaine ou IP).
- **Backend** : `config.env` — au minimum `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, `ADMIN_PASSWORD`.
- **Ansible** : `ansible/group_vars/all.yml` — `nginx_server_name`, `app_deploy_path`, `mongodb_uri`, `jwt_secret`, `admin_password`.
README

echo "✅ Export terminé: $DEST"
echo "   Fichiers: $(find "$DEST" -type f | wc -l)"
ls -la "$DEST"
