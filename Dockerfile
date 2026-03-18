# Dockerfile pour le backend GNV
# Utilisable avec Koyeb, Fly.io, ou toute plateforme Docker
# Build depuis la racine du projet avec: docker build -f Dockerfile --build-arg BUILD_CONTEXT=backend .

FROM node:22-alpine
# Node.js 22 est LTS actif jusqu'à avril 2027

WORKDIR /app

# Copier les fichiers de dépendances du backend
COPY backend/package*.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier le code du backend
COPY backend/ ./

# Créer le dossier uploads
RUN mkdir -p public/uploads

# Exposer le port (sera surchargé par la variable d'environnement PORT)
EXPOSE 3000

# Démarrer l'application
CMD ["node", "server.js"]

