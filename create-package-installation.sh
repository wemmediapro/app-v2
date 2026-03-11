#!/bin/bash
#
# Script de création du package d'installation sur le Bureau
# Crée le dossier "Appli-pour-installation" avec :
#   1. documentation/ — toute la documentation du projet
#   2. appli/ — l'application complète + dernière version de la base de données (si export possible)
#
# Usage: ./create-package-installation.sh
# À lancer depuis la racine du projet (où se trouve ce script)

set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Répertoire du projet (racine où se trouve ce script)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP="${HOME}/Desktop"
MAIN_DIR="${DESKTOP}/Appli-pour-installation"
DOC_DIR="${MAIN_DIR}/documentation"
APPLI_DIR="${MAIN_DIR}/appli"
DB_DIR="${APPLI_DIR}/base-de-donnees"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Création du package d'installation GNV OnBoard${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Vérifier qu'on est bien à la racine du projet
if [ ! -f "${PROJECT_ROOT}/package.json" ] || [ ! -d "${PROJECT_ROOT}/backend" ]; then
    echo -e "${RED}❌ Lancez ce script depuis la racine du projet app3.${NC}"
    exit 1
fi

# Créer la structure sur le Bureau
echo -e "${YELLOW}📁 Création du dossier sur le Bureau...${NC}"
rm -rf "${MAIN_DIR}"
mkdir -p "${DOC_DIR}"
mkdir -p "${APPLI_DIR}"
mkdir -p "${DB_DIR}"
echo -e "${GREEN}✅ ${MAIN_DIR}${NC}"
echo -e "   ├── documentation/"
echo -e "   └── appli/"
echo ""

# ─── 1. DOCUMENTATION ─────────────────────────────────────────────────────
echo -e "${YELLOW}📚 Copie de la documentation...${NC}"

# Documentation à la racine du projet (*.md et *.txt pertinents, hors node_modules)
for f in "${PROJECT_ROOT}"/*.md "${PROJECT_ROOT}"/*.txt; do
    [ -f "$f" ] && cp "$f" "${DOC_DIR}/" && echo "   + $(basename "$f")"
done

# Dossier docs/
if [ -d "${PROJECT_ROOT}/docs" ]; then
    mkdir -p "${DOC_DIR}/docs"
    cp -r "${PROJECT_ROOT}/docs/"* "${DOC_DIR}/docs/" 2>/dev/null || true
    echo "   + docs/"
fi

# Ansible (documentation déploiement)
if [ -d "${PROJECT_ROOT}/ansible" ]; then
    mkdir -p "${DOC_DIR}/ansible"
    cp -r "${PROJECT_ROOT}/ansible/"* "${DOC_DIR}/ansible/" 2>/dev/null || true
    echo "   + ansible/"
fi

# Documentation backend (fichiers .md à la racine backend + backend/docs)
for f in "${PROJECT_ROOT}/backend"/*.md; do
    [ -f "$f" ] && cp "$f" "${DOC_DIR}/" && echo "   + backend/$(basename "$f")"
done
if [ -d "${PROJECT_ROOT}/backend/docs" ]; then
    mkdir -p "${DOC_DIR}/backend-docs"
    cp -r "${PROJECT_ROOT}/backend/docs/"* "${DOC_DIR}/backend-docs/" 2>/dev/null || true
    echo "   + backend/docs → backend-docs/"
fi

# SBOM si présent
[ -f "${PROJECT_ROOT}/SBOM.md" ] && cp "${PROJECT_ROOT}/SBOM.md" "${DOC_DIR}/" 2>/dev/null || true
[ -f "${PROJECT_ROOT}/SBOM.json" ] && cp "${PROJECT_ROOT}/SBOM.json" "${DOC_DIR}/" 2>/dev/null || true

echo -e "${GREEN}✅ Documentation copiée dans: ${DOC_DIR}${NC}"
echo ""

# ─── 2. APPLICATION COMPLÈTE ─────────────────────────────────────────────
echo -e "${YELLOW}📦 Copie de l'application...${NC}"

# Exclusions (node_modules, build, secrets, logs, exports DB anciens, etc.)
RSYNC_EXCLUDE=(
    --exclude 'node_modules'
    --exclude 'dist'
    --exclude 'build'
    --exclude '.git'
    --exclude '.env'
    --exclude '.env.*'
    --exclude 'config.env'
    --exclude 'backend/config.env'
    --exclude 'backend/.env'
    --exclude 'logs'
    --exclude '*.log'
    --exclude 'database-export-*'
    --exclude 'gnv-database-*.tar.gz'
    --exclude '.DS_Store'
    --exclude '.vite'
    --exclude 'coverage'
    --exclude '.nyc_output'
)

# Dossiers et fichiers essentiels du projet
rsync -a "${RSYNC_EXCLUDE[@]}" "${PROJECT_ROOT}/backend" "${APPLI_DIR}/"
rsync -a "${RSYNC_EXCLUDE[@]}" "${PROJECT_ROOT}/src" "${APPLI_DIR}/"
rsync -a "${RSYNC_EXCLUDE[@]}" "${PROJECT_ROOT}/public" "${APPLI_DIR}/"
rsync -a "${RSYNC_EXCLUDE[@]}" "${PROJECT_ROOT}/dashboard" "${APPLI_DIR}/" 2>/dev/null || true
rsync -a "${RSYNC_EXCLUDE[@]}" "${PROJECT_ROOT}/scripts" "${APPLI_DIR}/" 2>/dev/null || true
rsync -a "${RSYNC_EXCLUDE[@]}" "${PROJECT_ROOT}/deploy" "${APPLI_DIR}/" 2>/dev/null || true

# Fichiers à la racine
for f in package.json package-lock.json vite.config.js index.html tailwind.config.js postcss.config.js \
         nginx.conf docker-compose.yml ecosystem.config.cjs ecosystem.production.cjs \
         .gitignore .htaccess Dockerfile; do
    [ -f "${PROJECT_ROOT}/$f" ] && cp "${PROJECT_ROOT}/$f" "${APPLI_DIR}/"
done

# Fichiers optionnels
for f in nginx-streaming.conf.example cyclic.json fly.toml railway.json render.yaml koyeb.yaml vercel.json; do
    [ -f "${PROJECT_ROOT}/$f" ] && cp "${PROJECT_ROOT}/$f" "${APPLI_DIR}/"
done

# Scripts shell utiles à la racine
for f in export-database.sh export-database-info.sh install-server.sh start-production.sh \
         setup-production-auto.sh INSTALL-APP3.sh start-all.sh verifier-base-de-donnees.sh; do
    [ -f "${PROJECT_ROOT}/$f" ] && cp "${PROJECT_ROOT}/$f" "${APPLI_DIR}/" && chmod +x "${APPLI_DIR}/$f"
done

# Fichier d'exemple pour la config (sans secrets)
if [ -f "${PROJECT_ROOT}/backend/env.example" ]; then
    cp "${PROJECT_ROOT}/backend/env.example" "${APPLI_DIR}/backend/env.example"
fi

echo -e "${GREEN}✅ Application copiée dans: ${APPLI_DIR}${NC}"
echo ""

# ─── 3. BASE DE DONNÉES (dernière version) ───────────────────────────────
echo -e "${YELLOW}🗄️  Export de la base de données (dernière version)...${NC}"

# Charger config pour mongodump
if [ -f "${PROJECT_ROOT}/backend/config.env" ]; then
    set -a
    # shellcheck source=/dev/null
    source <(grep -v '^#' "${PROJECT_ROOT}/backend/config.env" | grep -v '^$' | sed 's/^/export /')
    set +a
fi

DB_NAME_TO_EXPORT="${DB_NAME:-gnv_onboard}"
if [ -n "$MONGODB_URI" ]; then
    DB_NAME_TO_EXPORT=$(echo "$MONGODB_URI" | sed -n 's|.*/\([^/?]*\).*|\1|p')
    [ -z "$DB_NAME_TO_EXPORT" ] && DB_NAME_TO_EXPORT="gnv_onboard"
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
EXPORT_TAR="${DESKTOP}/gnv-database-backup-${TIMESTAMP}.tar.gz"
EXPORT_DIR="${DESKTOP}/gnv-database-export-${TIMESTAMP}"

export_ok=false
if command -v mongodump &>/dev/null; then
    if [[ -n "$MONGODB_URI" && "$MONGODB_URI" == mongodb+srv://* ]]; then
        if mongodump --uri="$MONGODB_URI" --out="${EXPORT_DIR}" 2>/dev/null; then
            cd "${DESKTOP}" && tar -czf "${EXPORT_TAR}" "$(basename "${EXPORT_DIR}")" 2>/dev/null && rm -rf "${EXPORT_DIR}"
            cp "${EXPORT_TAR}" "${DB_DIR}/gnv-database-backup-${TIMESTAMP}.tar.gz"
            export_ok=true
        fi
    else
        HOST="${MONGODB_URI#mongodb://}"
        HOST="${HOST%%/*}"
        HOST="${HOST%:*}"
        PORT="${MONGODB_URI#*:}"
        PORT="${PORT%%/*}"
        PORT="${PORT:-27017}"
        if mongosh --host "${HOST:-localhost}" --port "${PORT}" --eval "db.adminCommand('ping')" --quiet &>/dev/null; then
            if mongodump --host "${HOST:-localhost}" --port "${PORT}" --db "${DB_NAME_TO_EXPORT}" --out="${EXPORT_DIR}" 2>/dev/null; then
                cd "${DESKTOP}" && tar -czf "${EXPORT_TAR}" "$(basename "${EXPORT_DIR}")" 2>/dev/null && rm -rf "${EXPORT_DIR}"
                cp "${EXPORT_TAR}" "${DB_DIR}/gnv-database-backup-${TIMESTAMP}.tar.gz"
                export_ok=true
            fi
        fi
    fi
fi

if [ "$export_ok" = true ]; then
    echo -e "${GREEN}✅ Base de données exportée dans: ${DB_DIR}${NC}"
    echo "   Fichier: gnv-database-backup-${TIMESTAMP}.tar.gz"
else
    # Copier la dernière sauvegarde présente sur le Bureau si elle existe
    LATEST_BACKUP=""
    for f in "${DESKTOP}"/gnv-database-backup-*.tar.gz; do
        [ -f "$f" ] || continue
        [ -z "$LATEST_BACKUP" ] || [ "$f" -nt "$LATEST_BACKUP" ] && LATEST_BACKUP="$f"
    done
    if [ -n "$LATEST_BACKUP" ]; then
        cp "$LATEST_BACKUP" "${DB_DIR}/$(basename "$LATEST_BACKUP")"
        echo -e "${GREEN}✅ Dernière sauvegarde copiée dans: ${DB_DIR}${NC}"
        echo "   Fichier: $(basename "$LATEST_BACKUP")"
    else
        echo -e "${YELLOW}⚠️  Export MongoDB non effectué (MongoDB non démarré ou mongodump absent).${NC}"
        echo "   Un script d'initialisation est fourni dans l'application."
        echo "   Astuce: lancez d'abord ./export-database.sh pour exporter la base sur le Bureau, puis relancez ce script."
    fi
fi

# README base de données
cat > "${DB_DIR}/README.md" << 'EOF'
# Base de données — GNV OnBoard

## Si un fichier `.tar.gz` est présent

C’est un export MongoDB (dernière version au moment du packaging).

**Restaurer :**

```bash
# 1. Extraire l'archive (depuis appli/base-de-donnees/)
tar -xzf gnv-database-backup-XXXXXX.tar.gz

# 2. Restaurer (adapter l'URI si besoin)
mongorestore --uri="mongodb://localhost:27017/gnv_onboard" gnv-database-export-XXXXXX/gnv_onboard
```

## Sinon : initialiser la base avec les scripts

1. Installer et démarrer MongoDB (ou utiliser MongoDB Atlas).
2. Configurer `backend/config.env` (voir `backend/env.example`).
3. Depuis la racine de l’application :

```bash
cd backend
npm install
npm run init-db
```

Cela crée les collections et les données de démo avec le script `scripts/init-database.js`.
EOF

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Terminé${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "📁 Dossier créé : ${BLUE}${MAIN_DIR}${NC}"
echo ""
echo "   📚 documentation/  — Toute la documentation du projet"
echo "   📦 appli/          — Application complète (sans node_modules)"
echo "        └── base-de-donnees/  — Export DB ou instructions d’init"
echo ""
echo -e "${YELLOW}Pour installer l’application :${NC}"
echo "   1. cd ${APPLI_DIR}"
echo "   2. npm install && cd backend && npm install"
echo "   3. Copier backend/env.example vers backend/config.env et renseigner MONGODB_URI"
echo "   4. Restaurer la base (voir appli/base-de-donnees/README.md) ou lancer npm run init-db dans backend"
echo ""
