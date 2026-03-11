#!/bin/bash
# Script d'installation de MongoDB sur macOS
# Usage: ./INSTALL-MONGODB.sh

set -e

echo "🚀 Installation de MongoDB sur macOS"
echo "===================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Vérifier si Homebrew est installé
if ! command -v brew &> /dev/null; then
    echo -e "${YELLOW}⚠️  Homebrew n'est pas installé${NC}"
    echo ""
    echo "Installation de Homebrew..."
    echo "Vous devrez entrer votre mot de passe macOS"
    echo ""
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Configurer Homebrew dans le PATH
    if [ -d "/opt/homebrew" ]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -d "/usr/local" ]; then
        echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/usr/local/bin/brew shellenv)"
    fi
fi

echo -e "${GREEN}✅ Homebrew installé${NC}"
echo ""

# Vérifier Homebrew
if ! command -v brew &> /dev/null; then
    echo -e "${RED}❌ Erreur: Homebrew n'est toujours pas disponible${NC}"
    echo "   Veuillez redémarrer votre terminal et réessayer"
    exit 1
fi

echo -e "${YELLOW}📦 Ajout du tap MongoDB...${NC}"
brew tap mongodb/brew

echo -e "${YELLOW}📦 Installation de MongoDB Community Edition...${NC}"
brew install mongodb-community

echo -e "${YELLOW}🚀 Démarrage de MongoDB...${NC}"
brew services start mongodb-community

echo ""
echo -e "${GREEN}✅ MongoDB installé et démarré !${NC}"
echo ""
echo "Vérification de l'installation..."
sleep 2

# Vérifier que MongoDB fonctionne
if mongosh --eval "db.version()" &> /dev/null; then
    echo -e "${GREEN}✅ MongoDB fonctionne correctement${NC}"
    echo ""
    echo "📝 Prochaines étapes:"
    echo "   1. cd backend"
    echo "   2. npm run init-db"
    echo ""
else
    echo -e "${YELLOW}⚠️  MongoDB est installé mais la vérification a échoué${NC}"
    echo "   Essayez manuellement: mongosh --eval 'db.version()'"
fi


