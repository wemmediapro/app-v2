#!/usr/bin/env bash
# Crée sur le Bureau le dossier "appli pour installation v3" avec :
#   1. documentation/ — toute la documentation de la dernière version de l'appli
#   2. appli/        — dernière version de l'application complète pour hébergement + base de données
# Usage : depuis la racine du projet : ./scripts/export-installation-v3.sh

set -e
SRC="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
DESKTOP="${2:-$HOME/Desktop}"
DEST="$DESKTOP/appli pour installation v3"

echo "Source: $SRC"
echo "Destination: $DEST"
echo "---"

mkdir -p "$DEST/documentation"
mkdir -p "$DEST/appli"

# ---- 1. Documentation (tous les .md du projet hors node_modules) ----
echo "[1/2] Export documentation..."
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
for f in README.md INSTALLATION-RAPIDE-VM.md MANUEL-INSTALLATION-UBUNTU-22.04.md ARCHITECTURE.md SCHEMA-ARCHITECTURE.md AUDIT-ARCHITECTURE.md SPECIFICATIONS.md AUDIT-SECURITE.md DEPLOYMENT.md; do
  [ -f "$SRC/$f" ] && cp "$SRC/$f" "$DEST/documentation/" 2>/dev/null || true
done
echo "    Documentation exportée."

# ---- 2. Appli complète + base de données ----
echo "[2/2] Export application complète..."
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
  "$SRC/" "$DEST/appli/" 2>/dev/null || true
rm -rf "$DEST/appli/appli" 2>/dev/null || true
echo "    Application copiée."

echo "    Export base de données MongoDB..."
if mongodump --uri="mongodb://localhost:27017" --db=gnv_onboard --out="$DEST/appli/dump-mongodb" 2>/dev/null; then
  echo "    Base gnv_onboard exportée dans appli/dump-mongodb/"
else
  echo "    Attention: MongoDB non disponible, dump non créé. Vous pourrez lancer: mongodump --uri=mongodb://localhost:27017 --db=gnv_onboard --out=./dump-mongodb"
fi

# ---- README à la racine ----
cat > "$DEST/README.md" << 'EOF'
# Appli pour installation v3 — GNV OnBoard

Ce dossier contient tout le nécessaire pour une installation complète (version 3).

## Contenu

| Dossier | Description |
|---------|-------------|
| **documentation/** | Toute la documentation de la dernière version de l’application (fichiers .md du projet). |
| **appli/** | Dernière version de l’application complète pour hébergement (code source) + base de données (dump MongoDB dans `appli/dump-mongodb/gnv_onboard/`). |

## Installation

1. **Documentation** : consulter les fichiers dans `documentation/` (README.md, ARCHITECTURE.md, MANUEL-INSTALLATION-UBUNTU-22.04.md, etc.).
2. **Application** : le code est dans `appli/`. Suivre le manuel d’installation pour installer Node.js, MongoDB, Redis, puis restaurer la base si besoin :
   ```bash
   cd appli
   mongorestore --uri="mongodb://localhost:27017" --db=gnv_onboard dump-mongodb/gnv_onboard
   ```
   Puis configurer `backend/config.env`, installer les dépendances (`npm install`), builder et lancer avec PM2 ou Docker.

Voir `documentation/INSTALLATION-RAPIDE-VM.md` et `documentation/MANUEL-INSTALLATION-UBUNTU-22.04.md` pour le détail.
EOF

# ---- README dans appli ----
cat > "$DEST/appli/README-INSTALLATION.md" << 'EOF'
# Application GNV OnBoard — installation v3

Ce dossier contient l’application complète et le dump de la base de données.

- **Restauration de la base** : `mongorestore --uri="mongodb://localhost:27017" --db=gnv_onboard dump-mongodb/gnv_onboard`
- **Config** : copier `backend/config.production.env.example` vers `backend/config.env`
- **Dépendances** : `npm install` (racine, backend, dashboard)
- **Build** : `npm run build` (racine et dashboard)
- **Lancement** : `docker-compose up -d` pour MongoDB/Redis, puis `pm2 start ecosystem.production.cjs --env production`

La documentation complète est dans le dossier **documentation/** au niveau au-dessus.
EOF

echo "---"
echo "Export terminé : $DEST"
echo "  - documentation/  : documentation dernière version"
echo "  - appli/          : application complète + base de données"
