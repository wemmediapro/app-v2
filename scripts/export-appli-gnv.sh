#!/usr/bin/env bash
# Exporte sur le Bureau "appli gnv" :
#   - application/     : application complète à héberger (code source)
#   - documentation/   : documentation dernière version de l'appli
#   - hebergement-vm/   : fichiers pour héberger l'appli sur une VM
# Usage : depuis la racine du projet : ./scripts/export-appli-gnv.sh

set -e
SRC="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
DESKTOP="${2:-$HOME/Desktop}"
DEST="$DESKTOP/appli gnv"

echo "Source: $SRC"
echo "Destination: $DEST"
echo "---"

mkdir -p "$DEST/documentation"
mkdir -p "$DEST/hebergement-vm"
mkdir -p "$DEST/application"

# ---- Application complète à héberger ----
echo "Export application complète..."
rsync -a \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'backend/node_modules' \
  --exclude 'dashboard/node_modules' \
  --exclude 'frontend/node_modules' \
  --exclude 'logs' \
  --exclude '*.log' \
  --exclude '.env' \
  --exclude 'backend/config.env' \
  --exclude 'backend/.env' \
  --exclude 'dashboard/.env' \
  --exclude 'frontend/.env' \
  --exclude 'backend/public/uploads' \
  --exclude 'dump-mongodb' \
  "$SRC/" "$DEST/application/" 2>/dev/null || true
# Supprimer le dossier application à l'intérieur de application (éviter récursion)
rm -rf "$DEST/application/application" 2>/dev/null || true
echo "Application exportée."

# ---- Documentation (tous les .md du projet hors node_modules) ----
echo "Export documentation..."
find "$SRC" -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" \
  | while read -r f; do
  rel="${f#$SRC/}"
  dir="$DEST/documentation/$(dirname "$rel")"
  mkdir -p "$dir"
  cp "$f" "$DEST/documentation/$rel"
done
# Racine : README et docs principaux si pas déjà pris
for f in README.md INSTALLATION-RAPIDE-VM.md MANUEL-INSTALLATION-UBUNTU-22.04.md ARCHITECTURE.md SCHEMA-ARCHITECTURE.md AUDIT-ARCHITECTURE.md SPECIFICATIONS.md AUDIT-SECURITE.md DEPLOYMENT.md; do
  [ -f "$SRC/$f" ] && cp "$SRC/$f" "$DEST/documentation/" 2>/dev/null || true
done
echo "Documentation exportée."

# ---- Hébergement VM ----
echo "Export fichiers hébergement VM..."

# Ansible
mkdir -p "$DEST/hebergement-vm/ansible/group_vars"
mkdir -p "$DEST/hebergement-vm/ansible/roles/app/tasks"
mkdir -p "$DEST/hebergement-vm/ansible/roles/app/templates"
mkdir -p "$DEST/hebergement-vm/ansible/roles/nodejs/tasks"
mkdir -p "$DEST/hebergement-vm/ansible/roles/common/tasks"
mkdir -p "$DEST/hebergement-vm/ansible/roles/nginx/tasks"
mkdir -p "$DEST/hebergement-vm/ansible/roles/nginx/handlers"
mkdir -p "$DEST/hebergement-vm/ansible/roles/nginx/templates"
mkdir -p "$DEST/hebergement-vm/ansible/roles/redis/tasks"
mkdir -p "$DEST/hebergement-vm/ansible/roles/mongodb/tasks"
cp "$SRC/ansible/playbook.yml" "$SRC/ansible/inventory.yml" "$SRC/ansible/ansible.cfg" "$DEST/hebergement-vm/ansible/"
cp "$SRC/ansible/group_vars/all.yml" "$DEST/hebergement-vm/ansible/group_vars/"
cp "$SRC/ansible/README-ANSIBLE.md" "$DEST/hebergement-vm/ansible/" 2>/dev/null || true
cp "$SRC/ansible/roles/app/tasks/main.yml" "$DEST/hebergement-vm/ansible/roles/app/tasks/"
cp "$SRC/ansible/roles/app/templates/backend_config.env.j2" "$DEST/hebergement-vm/ansible/roles/app/templates/"
cp "$SRC/ansible/roles/nodejs/tasks/main.yml" "$DEST/hebergement-vm/ansible/roles/nodejs/tasks/"
cp "$SRC/ansible/roles/common/tasks/main.yml" "$DEST/hebergement-vm/ansible/roles/common/tasks/"
cp "$SRC/ansible/roles/nginx/tasks/main.yml" "$DEST/hebergement-vm/ansible/roles/nginx/tasks/"
cp "$SRC/ansible/roles/nginx/handlers/main.yml" "$DEST/hebergement-vm/ansible/roles/nginx/handlers/"
cp "$SRC/ansible/roles/nginx/templates/gnv-app.conf.j2" "$DEST/hebergement-vm/ansible/roles/nginx/templates/"
cp "$SRC/ansible/roles/redis/tasks/main.yml" "$DEST/hebergement-vm/ansible/roles/redis/tasks/"
cp "$SRC/ansible/roles/mongodb/tasks/main.yml" "$DEST/hebergement-vm/ansible/roles/mongodb/tasks/"

# Adapter Ansible pour appli gnv : app_source_path + rôle app sync depuis ce chemin
APP_ROLE="$DEST/hebergement-vm/ansible/roles/app/tasks/main.yml"
if [ -f "$APP_ROLE" ]; then
  sed 's|src: "{{ playbook_dir }}/../"|src: "{{ ((app_source_path | default(\x27\x27)) | length > 0) | ternary(app_source_path, playbook_dir + \x27/../\x27) | regex_replace(\x27/$\x27, \x27\x27) }}/"|' "$APP_ROLE" > "${APP_ROLE}.tmp" && mv "${APP_ROLE}.tmp" "$APP_ROLE"
fi
GV="$DEST/hebergement-vm/ansible/group_vars/all.yml"
if [ -f "$GV" ] && ! grep -q app_source_path "$GV" 2>/dev/null; then
  (echo "# Chemin source de l'application (optionnel). Ex. : /Users/user/Desktop/appli gnv/application"; echo "app_source_path: \"\""; echo ""; cat "$GV") > "${GV}.tmp" && mv "${GV}.tmp" "$GV"
fi

# Fichiers de déploiement
cp "$SRC/docker-compose.yml" "$SRC/nginx.conf" "$SRC/ecosystem.production.cjs" "$DEST/hebergement-vm/"
[ -f "$SRC/ecosystem.config.cjs" ] && cp "$SRC/ecosystem.config.cjs" "$DEST/hebergement-vm/" || true
mkdir -p "$DEST/hebergement-vm/backend"
cp "$SRC/backend/config.production.env.example" "$DEST/hebergement-vm/backend/"
mkdir -p "$DEST/hebergement-vm/backend/scripts"
cp "$SRC/backend/scripts/init-database.js" "$DEST/hebergement-vm/backend/scripts/" 2>/dev/null || true

# Doc d'installation rapide VM dans hebergement-vm
[ -f "$SRC/INSTALLATION-RAPIDE-VM.md" ] && cp "$SRC/INSTALLATION-RAPIDE-VM.md" "$DEST/hebergement-vm/" || true
[ -f "$SRC/MANUEL-INSTALLATION-UBUNTU-22.04.md" ] && cp "$SRC/MANUEL-INSTALLATION-UBUNTU-22.04.md" "$DEST/hebergement-vm/" || true

# README hébergement VM
cat > "$DEST/hebergement-vm/README-HEBERGEMENT-VM.md" << 'READMEVM'
# Hébergement GNV OnBoard sur une VM

Ce dossier contient tout ce qu’il faut pour héberger l’application sur une machine virtuelle (Ubuntu 22.04 ou 24.04).

## Contenu

- **ansible/** — Playbook et rôles pour installer MongoDB, Redis, Node.js, Nginx et déployer l’app (PM2).
- **docker-compose.yml** — Lancer uniquement MongoDB et Redis en conteneurs (optionnel si Ansible installe tout).
- **nginx.conf** — Exemple de site Nginx (à copier dans `/etc/nginx/sites-available/`).
- **ecosystem.production.cjs** — Configuration PM2 (backend + frontend + dashboard).
- **backend/config.production.env.example** — Variables d’environnement backend à copier en `config.env`.
- **backend/scripts/init-database.js** — Script d’initialisation de la base MongoDB.
- **INSTALLATION-RAPIDE-VM.md** / **MANUEL-INSTALLATION-UBUNTU-22.04.md** — Guides d’installation.

## Démarrage rapide (avec Ansible)

1. Copier le **code complet de l’application** sur votre machine (ou cloner le dépôt).
2. Dans `ansible/inventory.yml`, remplacer `IP_OU_DOMAINE` par l’IP ou le hostname de la VM.
3. Dans `ansible/group_vars/all.yml`, renseigner `nginx_server_name`, `jwt_secret`, `admin_password`, et éventuellement `app_source_path` si vous lancez Ansible depuis un autre répertoire que la racine de l’app.
4. Lancer le playbook depuis la **racine du projet** :
   ```bash
   ansible-playbook -i ansible/inventory.yml ansible/playbook.yml
   ```
5. Sur la VM : initialiser la base si besoin :
   ```bash
   cd /var/www/gnv-app && . ~/.nvm/nvm.sh && cd backend && node scripts/init-database.js
   ```

## Sans Ansible (manuel)

1. Sur la VM : installer Node.js 20, MongoDB (7 ou 8), Redis, Nginx.
2. Copier le code de l’app vers `/var/www/gnv-app` (ou autre).
3. Copier `backend/config.production.env.example` vers `backend/config.env` et adapter.
4. Copier `nginx.conf` vers `/etc/nginx/sites-available/gnv-app`, activer le site, recharger Nginx.
5. `npm install` (racine, backend, dashboard), `npm run build` (racine + dashboard).
6. Démarrer avec PM2 : `pm2 start ecosystem.production.cjs --env production`.

Voir **INSTALLATION-RAPIDE-VM.md** et **MANUEL-INSTALLATION-UBUNTU-22.04.md** pour le détail.
READMEVM

echo "Hébergement VM exporté."

# ---- Index documentation ----
cat > "$DEST/documentation/INDEX-DOCUMENTATION.md" << 'IDX'
# Index de la documentation — GNV OnBoard

Documentation de la dernière version de l’application.

## Principale (racine)

- **README.md** — Présentation et installation générale
- **ARCHITECTURE.md** — Architecture technique
- **SCHEMA-ARCHITECTURE.md** — Schéma services (MongoDB, Redis)
- **SPECIFICATIONS.md** — Spécifications fonctionnelles
- **INSTALLATION-RAPIDE-VM.md** — Installation rapide sur VM
- **MANUEL-INSTALLATION-UBUNTU-22.04.md** — Manuel détaillé Ubuntu 22.04
- **DEPLOYMENT.md** — Déploiement
- **AUDIT-SECURITE.md** — Audit sécurité

## Backend

- **backend/MONGODB.md** — MongoDB, Prisma (scripts), replica set
- **backend/CONNEXION-ANCIENNE-BASE.md** — Connexion ancienne base
- **backend/docs/** — Docs techniques (TMDB, etc.)

## Ansible

- **ansible/README-ANSIBLE.md** — Déploiement avec Ansible

Les autres fichiers .md présents dans ce dossier couvrent les audits, vérifications et chartes.
IDX

echo "---"
echo "Export terminé : $DEST"
echo "  - application/    : application complète à héberger"
echo "  - documentation/ : documentation à jour"
echo "  - hebergement-vm/  : fichiers pour héberger sur une VM"
