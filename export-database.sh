#!/bin/bash

# Script pour exporter la base de données MongoDB vers le bureau
# Usage: ./export-database.sh

# Ne pas quitter immédiatement en cas d'erreur pour permettre les messages d'aide
set +e

echo "🗄️  Export de la base de données MongoDB..."

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Charger les variables d'environnement depuis config.env
if [ -f "backend/config.env" ]; then
    # Charger les variables une par une pour éviter les problèmes avec xargs
    while IFS= read -r line || [ -n "$line" ]; do
        # Ignorer les lignes vides et les commentaires
        if [[ ! "$line" =~ ^[[:space:]]*# ]] && [[ -n "$line" ]]; then
            # Exporter la variable
            export "$line" 2>/dev/null || true
        fi
    done < backend/config.env
else
    echo -e "${RED}❌ Fichier backend/config.env introuvable${NC}"
    exit 1
fi

# Extraire le nom de la base de données depuis MONGODB_URI ou utiliser DB_NAME
if [ -n "$DB_NAME" ]; then
    DB_NAME_TO_EXPORT="$DB_NAME"
elif [ -n "$MONGODB_URI" ]; then
    # Extraire le nom de la base depuis l'URI
    DB_NAME_TO_EXPORT=$(echo "$MONGODB_URI" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    if [ -z "$DB_NAME_TO_EXPORT" ]; then
        DB_NAME_TO_EXPORT="gnv-onboard"
    fi
else
    DB_NAME_TO_EXPORT="gnv-onboard"
fi

echo -e "${YELLOW}📋 Base de données: $DB_NAME_TO_EXPORT${NC}"

# Vérifier si mongodump est installé
if ! command -v mongodump &> /dev/null; then
    echo -e "${RED}❌ mongodump n'est pas installé${NC}"
    echo -e "${YELLOW}💡 Installation de MongoDB Database Tools...${NC}"
    
    # Sur macOS avec Homebrew
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            echo "Installation via Homebrew..."
            brew tap mongodb/brew
            brew install mongodb-database-tools
        else
            echo -e "${RED}❌ Homebrew n'est pas installé. Veuillez installer MongoDB Database Tools manuellement.${NC}"
            echo "Téléchargez depuis: https://www.mongodb.com/try/download/database-tools"
            exit 1
        fi
    else
        echo -e "${RED}❌ Veuillez installer MongoDB Database Tools manuellement.${NC}"
        echo "Téléchargez depuis: https://www.mongodb.com/try/download/database-tools"
        exit 1
    fi
fi

# Créer le nom du fichier avec timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
EXPORT_DIR="$HOME/Desktop/gnv-database-export-$TIMESTAMP"
EXPORT_FILE="$HOME/Desktop/gnv-database-backup-$TIMESTAMP.tar.gz"

# Vérifier si MongoDB est accessible
echo -e "${YELLOW}🔍 Vérification de la connexion MongoDB...${NC}"

# Extraire les informations de connexion depuis MONGODB_URI
if [[ "$MONGODB_URI" == mongodb+srv://* ]]; then
    # MongoDB Atlas
    echo -e "${YELLOW}📡 Connexion à MongoDB Atlas...${NC}"
    mongodump --uri="$MONGODB_URI" --out="$EXPORT_DIR"
else
    # MongoDB local
    HOST=$(echo "$MONGODB_URI" | sed -n 's/mongodb:\/\/\([^:]*\):\([^/]*\)\/.*/\1/p')
    PORT=$(echo "$MONGODB_URI" | sed -n 's/mongodb:\/\/\([^:]*\):\([^/]*\)\/.*/\2/p')
    
    if [ -z "$HOST" ]; then
        HOST="localhost"
    fi
    if [ -z "$PORT" ]; then
        PORT="27017"
    fi
    
    echo -e "${YELLOW}📡 Connexion à MongoDB local ($HOST:$PORT)...${NC}"
    
    # Vérifier si MongoDB est démarré
    if command -v mongosh &> /dev/null; then
        if ! mongosh --host "$HOST" --port "$PORT" --eval "db.adminCommand('ping')" --quiet &> /dev/null; then
            echo -e "${RED}❌ MongoDB n'est pas accessible sur $HOST:$PORT${NC}"
            echo -e "${YELLOW}💡 Assurez-vous que MongoDB est démarré:${NC}"
            echo "   brew services start mongodb-community"
            echo ""
            echo -e "${YELLOW}💡 Ou utilisez MongoDB Atlas (cloud) en modifiant MONGODB_URI dans backend/config.env${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  mongosh n'est pas installé, tentative de connexion directe...${NC}"
    fi
    
    # Essayer d'exporter même si la vérification a échoué
    if ! mongodump --host "$HOST" --port "$PORT" --db "$DB_NAME_TO_EXPORT" --out="$EXPORT_DIR" 2>&1; then
        echo ""
        echo -e "${RED}❌ Échec de l'export MongoDB${NC}"
        echo ""
        echo -e "${YELLOW}💡 Solutions possibles:${NC}"
        echo ""
        echo "1. Démarrer MongoDB localement:"
        echo "   brew services start mongodb-community"
        echo ""
        echo "2. Ou installer MongoDB si ce n'est pas fait:"
        echo "   brew tap mongodb/brew"
        echo "   brew install mongodb-community"
        echo "   brew services start mongodb-community"
        echo ""
        echo "3. Ou utiliser MongoDB Atlas (cloud):"
        echo "   - Créez un compte sur https://www.mongodb.com/cloud/atlas"
        echo "   - Modifiez MONGODB_URI dans backend/config.env"
        echo ""
        echo -e "${YELLOW}📝 Note: Le mode démo est actuellement activé (DEMO_MODE=true)${NC}"
        echo "   Il n'y a peut-être pas de données réelles à exporter."
        exit 1
    fi
fi

# Vérifier si l'export a réussi
if [ ! -d "$EXPORT_DIR/$DB_NAME_TO_EXPORT" ]; then
    echo -e "${RED}❌ L'export a échoué - aucun dossier créé${NC}"
    echo -e "${YELLOW}💡 Vérifiez que MongoDB est démarré et que la base de données existe${NC}"
    exit 1
fi

# Créer une archive compressée
echo -e "${YELLOW}📦 Création de l'archive compressée...${NC}"
cd "$HOME/Desktop"
tar -czf "gnv-database-backup-$TIMESTAMP.tar.gz" "gnv-database-export-$TIMESTAMP"
rm -rf "gnv-database-export-$TIMESTAMP"

echo -e "${GREEN}✅ Export réussi !${NC}"
echo -e "${GREEN}📁 Fichier sauvegardé: $EXPORT_FILE${NC}"
echo ""
echo -e "${YELLOW}📊 Pour restaurer la base de données:${NC}"
echo "   mongorestore --uri=\"$MONGODB_URI\" --archive=\"$EXPORT_FILE\" --gzip"
echo ""
echo -e "${YELLOW}📊 Pour restaurer depuis un dossier:${NC}"
echo "   tar -xzf \"$EXPORT_FILE\""
echo "   mongorestore --uri=\"$MONGODB_URI\" \"gnv-database-export-$TIMESTAMP/$DB_NAME_TO_EXPORT\""
