#!/usr/bin/env bash
# Exporte sur le Bureau le dossier "appli" avec tout le nécessaire pour héberger
# la dernière version de l'application sur une VM : code source, base de données, documentation.
#
# Usage : depuis la racine du projet
#   ./scripts/export-appli-bureau-hebergement-vm.sh
#   ./scripts/export-appli-bureau-hebergement-vm.sh /chemin/vers/Bureau
#   ./scripts/export-appli-bureau-hebergement-vm.sh "$HOME/Desktop" "appli pour Khaled"
#   SANS_UPLOADS=0 ./scripts/export-appli-bureau-hebergement-vm.sh "$HOME/Desktop" "appli"   # avec médias
# Si le Bureau n'a pas assez de place pour les médias, exporter vers un disque externe :
#   SANS_UPLOADS=0 ./scripts/export-appli-bureau-hebergement-vm.sh /Volumes/NomDuDisque/Exports "appli"
#
# Crée : ~/Desktop/appli/  (ou $1/$2 si deux arguments sont fournis)

set -e
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP="${1:-$HOME/Desktop}"
FOLDER_NAME="${2:-appli}"
DEST="$DESKTOP/$FOLDER_NAME"

echo "Export hébergement VM — dernière version"
echo "Source:      $SRC"
echo "Destination: $DEST"
echo "---"

rm -rf "$DEST"
mkdir -p "$DEST"

# URI MongoDB (backend/config.env ou .env)
MONGODB_URI="mongodb://localhost:27017/gnv_onboard?directConnection=true"
DB_NAME="gnv_onboard"
for envfile in "$SRC/backend/config.env" "$SRC/backend/.env"; do
  if [ -f "$envfile" ]; then
    val=$(grep -E '^(MONGODB_URI|DATABASE_URL)=' "$envfile" 2>/dev/null | head -1 | cut -d= -f2- | sed -e "s/^['\"]//" -e "s/['\"]$//")
    [ -n "$val" ] && MONGODB_URI="$val" && break
  fi
done
if [[ "$MONGODB_URI" =~ /([a-zA-Z0-9_-]+)(\?|$) ]]; then DB_NAME="${BASH_REMATCH[1]}"; fi

# ---- 1. Code source (tout sauf node_modules, .git, logs, secrets, uploads volumineux) ----
# Pour inclure les uploads : SANS_UPLOADS=0 ./scripts/export-appli-bureau-hebergement-vm.sh ...
SANS_UPLOADS="${SANS_UPLOADS:-1}"
echo "[1/4] Code source..."
RSYNC_EXCLUDES=(
  --exclude 'node_modules'
  --exclude '.git'
  --exclude 'backend/node_modules'
  --exclude 'dashboard/node_modules'
  --exclude 'logs'
  --exclude '*.log'
  --exclude '.env'
  --exclude 'backend/config.env'
  --exclude 'backend/.env'
  --exclude 'dashboard/.env'
  --exclude 'dump-mongodb'
  --exclude 'dist'
  --exclude '.cursor'
  --exclude '*.pid'
  --exclude '.DS_Store'
)
[ "$SANS_UPLOADS" = "1" ] && RSYNC_EXCLUDES+=(--exclude 'backend/public/uploads')
# Avec médias : exclure uploads/temp (fichiers d'encodage temporaires, très volumineux)
[ "$SANS_UPLOADS" = "0" ] && RSYNC_EXCLUDES+=(--exclude 'backend/public/uploads/temp')
rsync -a "${RSYNC_EXCLUDES[@]}" \
  "$SRC/" "$DEST/"
# Si uploads exclus, garder la structure (dossier vide)
[ "$SANS_UPLOADS" = "1" ] && mkdir -p "$DEST/backend/public/uploads" && touch "$DEST/backend/public/uploads/.gitkeep"
# Ne pas garder un sous-dossier appli créé par erreur
rm -rf "$DEST/appli" 2>/dev/null || true
echo "    Code source copié. $([ "$SANS_UPLOADS" = "1" ] && echo '(uploads exclus)' || echo '(médias inclus, temp exclus)')"

# ---- 2. Base de données ----
echo "[2/4] Base de données MongoDB..."
if command -v mongodump &>/dev/null; then
  if mongodump --uri="$MONGODB_URI" --out="$DEST/dump-mongodb" 2>/dev/null; then
    echo "    Base $DB_NAME exportée dans dump-mongodb/"
  else
    echo "    Attention: export échoué (MongoDB local démarré ?). Dump non créé."
    rm -rf "$DEST/dump-mongodb" 2>/dev/null || true
  fi
else
  echo "    mongodump non trouvé. Installez MongoDB Tools. Puis:"
  echo "    mongodump --uri=\"$MONGODB_URI\" --out=\"$DEST/dump-mongodb\""
fi

# ---- 3. Documentation (racine + docs/) ----
echo "[3/4] Documentation..."
mkdir -p "$DEST/docs"
for f in README.md ARCHITECTURE.md DEPLOYMENT.md INSTALLATION-RAPIDE-VM.md MISE-A-JOUR-SERVEUR.md \
  SERVER-REQUIREMENTS.md SPECIFICATIONS.md PRODUCTION-GUIDE.md TROUBLESHOOTING.md; do
  [ -f "$SRC/$f" ] && cp "$SRC/$f" "$DEST/" 2>/dev/null || true
done
[ -d "$SRC/docs" ] && cp -R "$SRC/docs/"* "$DEST/docs/" 2>/dev/null || true
[ -d "$SRC/ansible" ] && cp -R "$SRC/ansible" "$DEST/" 2>/dev/null || true
echo "    Documentation copiée (README, INSTALLATION-RAPIDE-VM, docs/, ansible/)."

# ---- 4. Fichier d'exemple config (sans secrets) ----
if [ -f "$SRC/backend/config.production.env.example" ]; then
  cp "$SRC/backend/config.production.env.example" "$DEST/backend/config.env.example"
elif [ -f "$SRC/backend/config.env.example" ]; then
  cp "$SRC/backend/config.env.example" "$DEST/backend/config.env.example"
fi

# ---- README principal ----
cat > "$DEST/README-HEBERGEMENT-VM.md" << EOF
# GNV OnBoard — Export pour hébergement sur VM

Export du **$(date +%d/%m/%Y)** : dernière version de l'application prête à être déployée sur une VM (Ubuntu 22.04 / 24.04) avec base de données et documentation.

## Contenu

| Élément | Emplacement |
|--------|-------------|
| **Code source** | Racine du dossier (backend, dashboard, src, scripts, etc.) |
| **Base de données** | \`dump-mongodb/$DB_NAME/\` (à restaurer sur la VM avec \`mongorestore\`) |
| **Documentation** | \`README.md\`, \`INSTALLATION-RAPIDE-VM.md\`, \`MISE-A-JOUR-SERVEUR.md\`, \`docs/\`, \`ansible/\` |
| **Config exemple** | \`backend/config.env.example\` (à copier en \`backend/config.env\` sur la VM) |
| **Scripts déploiement** | \`scripts/deploy-to-vps.sh\`, \`scripts/update-vps.sh\`, \`scripts/install-on-vps-remote.sh\`, \`scripts/import-database-vps.sh\` |

## Déploiement sur une VM

### Option 1 : Déploiement manuel

1. Copier ce dossier \`appli\` sur la VM (scp, rsync, clé USB, etc.).
2. Sur la VM, suivre **INSTALLATION-RAPIDE-VM.md** :
   - Installer Node.js 20 (NVM), MongoDB, Redis, Nginx, PM2
   - Créer \`backend/config.env\` à partir de \`backend/config.env.example\`
   - \`npm install\` à la racine, dans \`backend/\` et \`dashboard/\`
   - \`npm run build\` à la racine et dans \`dashboard/\`
   - Restaurer la base : \`mongorestore --uri="mongodb://localhost:27017" --db=$DB_NAME --drop dump-mongodb/$DB_NAME\`
   - \`pm2 start ecosystem.config.cjs --env production\`
   - Configurer Nginx (voir \`docs/\` ou \`INSTALLATION-RAPIDE-VM.md\`)

### Option 2 : Déploiement avec scripts (depuis votre machine)

Depuis votre poste (avec ce dossier ou le dépôt Git à jour) :

\`\`\`bash
# Mettre à jour la variable VPS dans scripts/deploy-to-vps.sh (ex: root@IP_DE_LA_VM)
./scripts/deploy-to-vps.sh
\`\`\`

Le script envoie le code + dump sur la VM, lance l’installation et importe la base.

### Option 3 : Ansible

Voir \`ansible/README-ANSIBLE.md\` et \`INSTALLATION-RAPIDE-VM.md\` (option A).

## Mise à jour après déploiement

\`\`\`bash
# Code seul
./scripts/update-vps.sh

# Code + base de données
UPDATE_DB=1 ./scripts/update-vps.sh
\`\`\`

Voir **MISE-A-JOUR-SERVEUR.md** pour tous les cas (VPS, Hostinger, Railway, etc.).

## Vérifications

- Backend : \`http://IP_VM/api/health\`
- Frontend : \`http://IP_VM/\`
- Dashboard : \`http://IP_VM/dashboard/\`
EOF

echo "[4/4] README-HEBERGEMENT-VM.md créé."

echo "---"
echo "Export terminé : $DEST"
echo "  - Code source (backend, dashboard, src, scripts, uploads)"
echo "  - Base de données : dump-mongodb/$DB_NAME/"
echo "  - Documentation : README, INSTALLATION-RAPIDE-VM.md, docs/, ansible/"
echo "  - Lire : $DEST/README-HEBERGEMENT-VM.md"
