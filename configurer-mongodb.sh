#!/bin/bash

# Script de configuration automatique de MongoDB pour GNV OnBoard
# Ce script configure MongoDB Atlas ou vérifie la connexion locale

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🚀 Configuration MongoDB pour GNV OnBoard"
echo ""

# Vérifier si MongoDB est déjà configuré
if grep -q "MONGODB_URI=mongodb+srv://" backend/config.env 2>/dev/null; then
    echo -e "${GREEN}✅ MongoDB Atlas déjà configuré${NC}"
    MONGODB_URI=$(grep "MONGODB_URI=" backend/config.env | cut -d'=' -f2)
    echo "   URI: ${MONGODB_URI:0:50}..."
    echo ""
    echo "Pour tester la connexion, redémarrez le serveur backend."
    exit 0
fi

# Vérifier MongoDB local
echo "🔍 Vérification de MongoDB local..."
if command -v mongosh &> /dev/null; then
    if mongosh --eval "db.adminCommand('ping')" --quiet 2>/dev/null | grep -q "ok.*1"; then
        echo -e "${GREEN}✅ MongoDB local est disponible${NC}"
        echo ""
        echo "Configuration actuelle:"
        echo "  MONGODB_URI=mongodb://localhost:27017/gnv-onboard"
        echo ""
        echo "Pour utiliser MongoDB local, assurez-vous que:"
        echo "  - DEMO_MODE=false dans backend/config.env"
        echo "  - MongoDB est démarré"
        exit 0
    fi
fi

# MongoDB non disponible localement
echo -e "${YELLOW}⚠️  MongoDB local non disponible${NC}"
echo ""
echo "📋 Options disponibles:"
echo ""
echo "1. MongoDB Atlas (Cloud - Gratuit) - RECOMMANDÉ"
echo "2. Installer MongoDB localement"
echo ""
read -p "Choisissez une option (1 ou 2): " choice

if [ "$choice" = "1" ]; then
    echo ""
    echo -e "${BLUE}📝 Configuration MongoDB Atlas${NC}"
    echo ""
    echo "Étapes:"
    echo "1. Créez un compte gratuit sur: https://www.mongodb.com/cloud/atlas/register"
    echo "2. Créez un cluster M0 (gratuit)"
    echo "3. Configurez l'accès réseau (Allow from anywhere pour développement)"
    echo "4. Créez un utilisateur de base de données"
    echo "5. Obtenez la chaîne de connexion"
    echo ""
    read -p "Entrez votre chaîne de connexion MongoDB Atlas: " mongo_uri
    
    if [ -z "$mongo_uri" ]; then
        echo -e "${RED}❌ Chaîne de connexion vide${NC}"
        exit 1
    fi
    
    # Ajouter le nom de la base de données si absent
    if [[ ! "$mongo_uri" == *"/gnv-onboard"* ]]; then
        mongo_uri="${mongo_uri%/}/gnv-onboard?retryWrites=true&w=majority"
    fi
    
    # Mettre à jour config.env
    if grep -q "MONGODB_URI=" backend/config.env; then
        sed -i '' "s|MONGODB_URI=.*|MONGODB_URI=$mongo_uri|" backend/config.env
    else
        echo "MONGODB_URI=$mongo_uri" >> backend/config.env
    fi
    
    # S'assurer que le mode démo est désactivé
    sed -i '' 's/DEMO_MODE=true/DEMO_MODE=false/' backend/config.env
    sed -i '' 's/FORCE_DEMO=true/FORCE_DEMO=false/' backend/config.env
    
    echo ""
    echo -e "${GREEN}✅ Configuration MongoDB Atlas terminée!${NC}"
    echo ""
    echo "Prochaines étapes:"
    echo "1. Redémarrer le serveur backend"
    echo "2. Initialiser la base de données: cd backend && npm run init-db-prisma"
    
elif [ "$choice" = "2" ]; then
    echo ""
    echo -e "${BLUE}📦 Installation MongoDB locale${NC}"
    echo ""
    echo "Méthodes d'installation:"
    echo ""
    echo "Option A: Via Homebrew (si disponible)"
    echo "  brew tap mongodb/brew"
    echo "  brew install mongodb-community"
    echo "  brew services start mongodb-community"
    echo ""
    echo "Option B: Téléchargement manuel"
    echo "  https://www.mongodb.com/try/download/community"
    echo ""
    echo "Après l'installation, exécutez ce script à nouveau."
    
else
    echo -e "${RED}❌ Option invalide${NC}"
    exit 1
fi

