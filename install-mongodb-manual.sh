#!/bin/bash
# Script d'installation manuelle de MongoDB sur macOS
# Usage: ./install-mongodb-manual.sh

set -e

echo "📦 Installation Manuelle de MongoDB"
echo "===================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Vérifier si MongoDB est déjà installé
if command -v mongod &> /dev/null; then
    echo -e "${GREEN}✅ MongoDB est déjà installé${NC}"
    mongod --version
    exit 0
fi

echo -e "${YELLOW}📥 Téléchargement de MongoDB...${NC}"
echo ""
echo "Veuillez télécharger MongoDB manuellement :"
echo "1. Allez sur https://www.mongodb.com/try/download/community"
echo "2. Sélectionnez :"
echo "   - Version: 8.0"
echo "   - Platform: macOS"
echo "   - Package: tgz"
echo "3. Téléchargez le fichier"
echo ""
read -p "Appuyez sur Entrée une fois le téléchargement terminé..."

# Trouver le fichier téléchargé
DOWNLOAD_DIR="$HOME/Downloads"
TGZ_FILE=$(find "$DOWNLOAD_DIR" -name "mongodb-macos*.tgz" -type f | head -1)

if [ -z "$TGZ_FILE" ]; then
    echo -e "${RED}❌ Fichier MongoDB non trouvé dans ~/Downloads${NC}"
    echo "   Veuillez télécharger MongoDB depuis https://www.mongodb.com/try/download/community"
    exit 1
fi

echo -e "${GREEN}✅ Fichier trouvé: $TGZ_FILE${NC}"
echo ""

# Extraire l'archive
echo -e "${YELLOW}📦 Extraction de l'archive...${NC}"
cd "$DOWNLOAD_DIR"
EXTRACT_DIR=$(tar -tzf "$TGZ_FILE" | head -1 | cut -f1 -d"/")
tar -xzf "$TGZ_FILE"

# Créer le dossier de destination
echo -e "${YELLOW}📁 Installation de MongoDB...${NC}"
sudo mkdir -p /usr/local/mongodb
sudo mv "$EXTRACT_DIR"/* /usr/local/mongodb/
rm -rf "$EXTRACT_DIR"

# Créer les dossiers de données
echo -e "${YELLOW}📁 Création des dossiers de données...${NC}"
sudo mkdir -p /usr/local/var/mongodb
sudo mkdir -p /usr/local/var/log/mongodb
sudo chown -R $(whoami) /usr/local/var/mongodb
sudo chown -R $(whoami) /usr/local/var/log/mongodb

# Ajouter au PATH
echo -e "${YELLOW}🔧 Configuration du PATH...${NC}"
if [[ "$SHELL" == *"zsh"* ]]; then
    if ! grep -q "/usr/local/mongodb/bin" ~/.zshrc; then
        echo 'export PATH="/usr/local/mongodb/bin:$PATH"' >> ~/.zshrc
    fi
    export PATH="/usr/local/mongodb/bin:$PATH"
elif [[ "$SHELL" == *"bash"* ]]; then
    if ! grep -q "/usr/local/mongodb/bin" ~/.bash_profile; then
        echo 'export PATH="/usr/local/mongodb/bin:$PATH"' >> ~/.bash_profile
    fi
    export PATH="/usr/local/mongodb/bin:$PATH"
fi

# Vérifier l'installation
if command -v mongod &> /dev/null; then
    echo -e "${GREEN}✅ MongoDB installé avec succès !${NC}"
    echo ""
    mongod --version
    echo ""
    echo -e "${YELLOW}🚀 Démarrage de MongoDB...${NC}"
    mongod --dbpath /usr/local/var/mongodb --logpath /usr/local/var/log/mongodb/mongo.log --fork
    
    sleep 2
    
    if mongosh --eval "db.version()" &> /dev/null; then
        echo -e "${GREEN}✅ MongoDB démarré et fonctionne !${NC}"
        echo ""
        echo "📝 Prochaines étapes:"
        echo "   1. cd backend"
        echo "   2. npm run init-db"
    else
        echo -e "${YELLOW}⚠️  MongoDB démarré mais la vérification a échoué${NC}"
        echo "   Essayez manuellement: mongosh --eval 'db.version()'"
    fi
else
    echo -e "${RED}❌ Erreur lors de l'installation${NC}"
    echo "   MongoDB n'est pas dans le PATH"
    echo "   Essayez de redémarrer votre terminal"
    exit 1
fi


