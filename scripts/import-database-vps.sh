#!/bin/bash
# Import / initialisation de la base de données sur le VPS
# À exécuter sur le serveur : bash scripts/import-database-vps.sh
# Ou depuis votre machine : SSHPASS='...' ssh root@IP 'bash /var/www/gnv-app/scripts/import-database-vps.sh'

set -e
APP_DIR="${APP_DIR:-/var/www/gnv-app}"

cd "$APP_DIR"

# Option 1 : si un dump MongoDB existe (dossier dump-mongodb/gnv_onboard)
if [ -d "dump-mongodb/gnv_onboard" ]; then
  echo "Restauration depuis dump-mongodb/gnv_onboard..."
  mongorestore --uri="mongodb://localhost:27017" --db=gnv_onboard --drop dump-mongodb/gnv_onboard
  echo "Restauration terminée."
else
  # Option 2 : initialisation via le script backend (utilisateurs, restaurants, films, etc.)
  echo "Initialisation de la base via init-database.js..."
  cd backend
  export NVM_DIR="/root/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  npm run init-db
  cd ..
  echo "Initialisation terminée."
fi

echo "Redémarrage du backend..."
export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
pm2 restart gnv-backend 2>/dev/null || true
echo "Base de données prête."
