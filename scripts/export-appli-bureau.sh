#!/usr/bin/env bash
# Exporte sur le Bureau l'application avec :
#   - appli avec code source/  : code source complet (dernière version) + fichiers uploads
#   - base de données (dump MongoDB) dans appli avec code source/dump-mongodb/
# Usage : depuis la racine du projet : ./scripts/export-appli-bureau.sh

set -e
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP="${1:-$HOME/Desktop}"
DEST="$DESKTOP/appli avec code source"

echo "Source: $SRC"
echo "Destination: $DEST"
echo "---"

mkdir -p "$DEST"

# Charger l'URI MongoDB depuis le backend (config.env ou .env)
MONGODB_URI="mongodb://localhost:27017/gnv_onboard?directConnection=true"
DB_NAME="gnv_onboard"
for envfile in "$SRC/backend/config.env" "$SRC/backend/.env"; do
  if [ -f "$envfile" ]; then
    val=$(grep -E '^(MONGODB_URI|DATABASE_URL)=' "$envfile" 2>/dev/null | head -1 | cut -d= -f2- | sed -e "s/^['\"]//" -e "s/['\"]$//")
    [ -n "$val" ] && MONGODB_URI="$val" && break
  fi
done
if [[ "$MONGODB_URI" =~ /([a-zA-Z0-9_-]+)(\?|$) ]]; then DB_NAME="${BASH_REMATCH[1]}"; fi

# ---- 1. Code source complet + fichiers (uploads) ----
echo "[1/2] Export du code source complet (dernière version) et des fichiers..."
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
  --exclude 'dump-mongodb' \
  "$SRC/" "$DEST/" 2>/dev/null || true
# Éviter un sous-dossier récursif "appli avec code source" à l'intérieur
rm -rf "$DEST/appli avec code source" 2>/dev/null || true
echo "    Code source et fichiers exportés."

# ---- 2. Base de données (dernière version) ----
echo "[2/2] Export de la base de données MongoDB..."
if command -v mongodump &>/dev/null; then
  if mongodump --uri="$MONGODB_URI" --out="$DEST/dump-mongodb" 2>/dev/null; then
    echo "    Base $DB_NAME exportée dans dump-mongodb/"
  else
    echo "    Attention: export MongoDB échoué (MongoDB local démarré ?). Vous pourrez lancer:"
    echo "    mongodump --uri=\"$MONGODB_URI\" --out=\"$DEST/dump-mongodb\""
    rm -rf "$DEST/dump-mongodb" 2>/dev/null || true
  fi
else
  echo "    mongodump non trouvé. Installez MongoDB Tools. Puis exécutez:"
  echo "    mongodump --uri=\"$MONGODB_URI\" --out=\"$DEST/dump-mongodb\""
fi

# ---- README ----
cat > "$DEST/README-EXPORT.md" << EOF
# Application GNV OnBoard — export du $(date +%d/%m/%Y)

Ce dossier contient la **dernière version** de l'application : code source complet et base de données.

## Contenu

- **Code source** : tout le projet (src, backend, dashboard, scripts, etc.) sans node_modules ni .git
- **Fichiers** : backend/public/uploads (vidéos, images, etc.)
- **Base de données** : dump MongoDB dans \`dump-mongodb/$DB_NAME/\`

## Restauration rapide

1. **MongoDB** (si le dump est présent) :
   \`\`\`bash
   mongorestore --uri="mongodb://localhost:27017" --db=$DB_NAME --drop dump-mongodb/$DB_NAME
   \`\`\`

2. **Config** : copier \`backend/config.production.env.example\` vers \`backend/config.env\` et adapter.

3. **Dépendances** : \`npm install\` à la racine, dans \`backend/\` et \`dashboard/\`.

4. **Build** : \`npm run build\` à la racine et dans \`dashboard/\`.

5. **Lancement** : MongoDB + Redis (Docker ou système), puis \`pm2 start ecosystem.production.cjs --env production\`.
EOF

echo "---"
echo "Export terminé : $DEST"
echo "  - Code source complet + fichiers (uploads)"
echo "  - Base de données : dump-mongodb/$DB_NAME/"
