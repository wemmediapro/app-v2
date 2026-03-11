#!/usr/bin/env bash
# Démarre MongoDB pour le backend GNV OnBoard (Docker ou rappel des commandes)

set -e
MONGO_IMAGE="${MONGO_IMAGE:-mongo:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-gnv-mongo}"
PORT="${MONGO_PORT:-27017}"

echo "🔍 Vérification de MongoDB pour GNV OnBoard (port $PORT)..."
echo ""

# Déjà un conteneur arrêté ?
if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
  echo "📦 Conteneur existant '$CONTAINER_NAME' trouvé."
  docker start "$CONTAINER_NAME" && echo "✅ MongoDB démarré (conteneur existant)." && exit 0
fi

# Docker disponible ?
if ! command -v docker &>/dev/null; then
  echo "❌ Docker n'est pas installé ou pas dans le PATH."
  echo ""
  echo "   Option 1 — Installer Docker Desktop : https://www.docker.com/products/docker-desktop/"
  echo "   Option 2 — MongoDB local (macOS) : brew tap mongodb/brew && brew install mongodb-community"
  echo "            Puis : brew services start mongodb-community"
  echo ""
  exit 1
fi

# Démarrer le démon Docker (macOS)
if ! docker info &>/dev/null; then
  echo "❌ Le démon Docker ne répond pas. Démarrez Docker Desktop puis relancez ce script."
  echo "   Ou lancez manuellement : docker run -d -p ${PORT}:27017 --name ${CONTAINER_NAME} ${MONGO_IMAGE}"
  exit 1
fi

echo "📦 Démarrage de MongoDB (image: $MONGO_IMAGE)..."
docker run -d -p "${PORT}:27017" --name "$CONTAINER_NAME" "$MONGO_IMAGE"
echo "✅ MongoDB démarré. Connexion : mongodb://localhost:${PORT}/gnv_onboard"
echo ""
echo "   Redémarrez le backend (ou attendez la reconnexion auto) pour créer/modifier les chaînes WebTV."
