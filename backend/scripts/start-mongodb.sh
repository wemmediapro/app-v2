#!/usr/bin/env bash
# Démarre MongoDB avec Docker — redémarrage automatique si arrêt ou crash.
# Usage: ./scripts/start-mongodb.sh   ou   bash scripts/start-mongodb.sh

set -e
CONTAINER_NAME="gnv-mongo"
IMAGE="mongo:7"
PORT="${MONGODB_PORT:-27017}"

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Conteneur ${CONTAINER_NAME} existant — démarrage..."
  docker start "${CONTAINER_NAME}"
  docker update --restart unless-stopped "${CONTAINER_NAME}" 2>/dev/null || true
else
  echo "Création et démarrage de ${CONTAINER_NAME} (port ${PORT})..."
  docker run -d \
    --name "${CONTAINER_NAME}" \
    -p "${PORT}:27017" \
    --restart unless-stopped \
    "${IMAGE}"
fi

echo "MongoDB prêt sur localhost:${PORT}"
docker ps --filter name="${CONTAINER_NAME}"
