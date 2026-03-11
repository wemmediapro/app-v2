#!/bin/bash

# Script de configuration automatique de MongoDB Atlas
# Usage: ./configurer-mongodb-auto.sh "votre-chaine-de-connexion"

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🚀 Configuration MongoDB pour GNV OnBoard"
echo ""

# Vérifier si une chaîne de connexion est fournie
if [ -z "$1" ]; then
    echo -e "${YELLOW}⚠️  Aucune chaîne de connexion fournie${NC}"
    echo ""
    echo "Usage: ./configurer-mongodb-auto.sh \"mongodb+srv://user:pass@cluster.mongodb.net/...\""
    echo ""
    echo "📋 Pour obtenir votre chaîne de connexion MongoDB Atlas:"
    echo ""
    echo "1. Créez un compte sur: https://www.mongodb.com/cloud/atlas/register"
    echo "2. Créez un cluster M0 (gratuit)"
    echo "3. Configurez l'accès réseau (Allow from anywhere)"
    echo "4. Créez un utilisateur de base de données"
    echo "5. Cliquez sur 'Connect' > 'Connect your application'"
    echo "6. Copiez la chaîne de connexion"
    echo ""
    echo "Ensuite, exécutez:"
    echo "  ./configurer-mongodb-auto.sh \"votre-chaine-de-connexion\""
    echo ""
    exit 1
fi

MONGO_URI="$1"

# Nettoyer et formater la chaîne de connexion
# Ajouter le nom de la base de données si absent
if [[ ! "$MONGO_URI" == *"/gnv-onboard"* ]]; then
    # Remplacer le ? par /gnv-onboard? si présent
    if [[ "$MONGO_URI" == *"?"* ]]; then
        MONGO_URI="${MONGO_URI/\?/\/gnv-onboard?}"
    else
        MONGO_URI="${MONGO_URI%/}/gnv-onboard?retryWrites=true&w=majority"
    fi
fi

echo -e "${BLUE}📝 Configuration de MongoDB Atlas...${NC}"
echo ""

# Vérifier si config.env existe
if [ ! -f "backend/config.env" ]; then
    echo -e "${RED}❌ Fichier backend/config.env non trouvé${NC}"
    exit 1
fi

# Sauvegarder l'ancien fichier
cp backend/config.env backend/config.env.backup
echo "✅ Sauvegarde créée: backend/config.env.backup"

# Mettre à jour MONGODB_URI
if grep -q "MONGODB_URI=" backend/config.env; then
    # macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|MONGODB_URI=.*|MONGODB_URI=$MONGO_URI|" backend/config.env
    else
        sed -i "s|MONGODB_URI=.*|MONGODB_URI=$MONGO_URI|" backend/config.env
    fi
else
    echo "MONGODB_URI=$MONGO_URI" >> backend/config.env
fi

# Désactiver le mode démo
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' 's/DEMO_MODE=true/DEMO_MODE=false/' backend/config.env
    sed -i '' 's/FORCE_DEMO=true/FORCE_DEMO=false/' backend/config.env
else
    sed -i 's/DEMO_MODE=true/DEMO_MODE=false/' backend/config.env
    sed -i 's/FORCE_DEMO=true/FORCE_DEMO=false/' backend/config.env
fi

echo -e "${GREEN}✅ Configuration terminée!${NC}"
echo ""
echo "📋 Configuration appliquée:"
echo "   MONGODB_URI=${MONGO_URI:0:60}..."
echo "   DEMO_MODE=false"
echo "   FORCE_DEMO=false"
echo ""
echo "🚀 Prochaines étapes:"
echo ""
echo "1. Redémarrer le serveur backend:"
echo "   cd backend"
echo "   npm run dev"
echo ""
echo "2. Initialiser la base de données:"
echo "   cd backend"
echo "   npm run init-db-prisma"
echo ""
echo "✅ Votre application utilisera maintenant MongoDB Atlas!"

