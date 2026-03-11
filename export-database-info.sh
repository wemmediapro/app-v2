#!/bin/bash

# Script pour créer un rapport sur l'état de la base de données et exporter les informations disponibles
# Usage: ./export-database-info.sh

echo "📊 Création d'un rapport sur l'état de la base de données..."

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
# Créer d'abord dans le projet, puis copier sur le bureau
PROJECT_EXPORT_DIR="./database-export-$TIMESTAMP"
REPORT_FILE="$PROJECT_EXPORT_DIR/gnv-database-report.txt"
EXPORT_DIR="$PROJECT_EXPORT_DIR"

mkdir -p "$EXPORT_DIR"

{
    echo "═══════════════════════════════════════════════════════════════"
    echo "  RAPPORT SUR L'ÉTAT DE LA BASE DE DONNÉES GNV"
    echo "  Date: $(date)"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    
    # Configuration
    echo "📋 CONFIGURATION"
    echo "───────────────────────────────────────────────────────────────"
    if [ -f "backend/config.env" ]; then
        echo "Fichier de configuration: backend/config.env"
        echo ""
        echo "Variables importantes:"
        grep -E "^(MONGODB_URI|DB_NAME|DEMO_MODE|FORCE_DEMO)=" backend/config.env | sed 's/^/  /'
    else
        echo "❌ Fichier backend/config.env introuvable"
    fi
    echo ""
    
    # État MongoDB
    echo "🗄️  ÉTAT MONGODB"
    echo "───────────────────────────────────────────────────────────────"
    if command -v mongod &> /dev/null; then
        echo "✅ MongoDB est installé"
        MONGOD_PATH=$(which mongod)
        echo "  Emplacement: $MONGOD_PATH"
    else
        echo "❌ MongoDB n'est PAS installé"
    fi
    echo ""
    
    if command -v mongosh &> /dev/null; then
        echo "✅ MongoDB Shell (mongosh) est installé"
    else
        echo "❌ MongoDB Shell (mongosh) n'est PAS installé"
    fi
    echo ""
    
    if command -v mongodump &> /dev/null; then
        echo "✅ MongoDB Database Tools (mongodump) est installé"
    else
        echo "❌ MongoDB Database Tools (mongodump) n'est PAS installé"
    fi
    echo ""
    
    # Vérifier si MongoDB est démarré
    if command -v mongosh &> /dev/null; then
        if mongosh --eval "db.adminCommand('ping')" --quiet &> /dev/null; then
            echo "✅ MongoDB est démarré et accessible"
        else
            echo "❌ MongoDB n'est PAS démarré ou n'est pas accessible"
        fi
    else
        echo "⚠️  Impossible de vérifier (mongosh non installé)"
    fi
    echo ""
    
    # Modèles de données
    echo "📦 MODÈLES DE DONNÉES"
    echo "───────────────────────────────────────────────────────────────"
    if [ -d "backend/src/models" ]; then
        echo "Modèles Mongoose (backend/src/models/):"
        ls -1 backend/src/models/*.js 2>/dev/null | wc -l | xargs echo "  Nombre de modèles:"
        ls -1 backend/src/models/*.js 2>/dev/null | sed 's|.*/||' | sed 's/^/  - /'
    fi
    echo ""
    
    if [ -d "backend/models" ]; then
        echo "Modèles Mongoose (backend/models/):"
        ls -1 backend/models/*.js 2>/dev/null | wc -l | xargs echo "  Nombre de modèles:"
        ls -1 backend/models/*.js 2>/dev/null | sed 's|.*/||' | sed 's/^/  - /'
    fi
    echo ""
    
    if [ -f "backend/prisma/schema.prisma" ]; then
        echo "Modèles Prisma (backend/prisma/schema.prisma):"
        grep -E "^model " backend/prisma/schema.prisma | sed 's/model //' | sed 's/ {.*//' | sed 's/^/  - /'
    fi
    echo ""
    
    # Instructions pour exporter
    echo "📤 INSTRUCTIONS POUR EXPORTER LA BASE DE DONNÉES"
    echo "───────────────────────────────────────────────────────────────"
    echo ""
    echo "Option 1: Installer et démarrer MongoDB localement"
    echo "  1. Installer MongoDB:"
    echo "     brew tap mongodb/brew"
    echo "     brew install mongodb-community"
    echo ""
    echo "  2. Démarrer MongoDB:"
    echo "     brew services start mongodb-community"
    echo ""
    echo "  3. Exporter la base de données:"
    echo "     ./export-database.sh"
    echo ""
    echo "Option 2: Utiliser MongoDB Atlas (Cloud - Gratuit)"
    echo "  1. Créer un compte: https://www.mongodb.com/cloud/atlas"
    echo "  2. Créer un cluster gratuit (M0)"
    echo "  3. Configurer MONGODB_URI dans backend/config.env"
    echo "  4. Exporter avec: ./export-database.sh"
    echo ""
    echo "Option 3: Exporter depuis MongoDB Atlas directement"
    echo "  1. Connectez-vous à MongoDB Atlas"
    echo "  2. Allez dans votre cluster > Command Line Tools"
    echo "  3. Utilisez mongodump avec votre URI de connexion"
    echo ""
    
    # Structure des données
    echo "📊 STRUCTURE DES DONNÉES"
    echo "───────────────────────────────────────────────────────────────"
    echo ""
    echo "Collections attendues dans la base de données:"
    echo "  - users (Utilisateurs)"
    echo "  - restaurants (Restaurants)"
    echo "  - feedbacks (Feedback/Réclamations)"
    echo "  - messages (Messages/Chat)"
    echo "  - products (Produits Shop)"
    echo "  - articles (Articles Magazine)"
    echo "  - banners (Bannières)"
    echo "  - destinations (Destinations)"
    echo "  - enfantactivities (Activités enfants)"
    echo "  - ships (Navires)"
    echo "  - shipmaps (Plans du navire)"
    echo "  - webtvchannels (Chaînes WebTV)"
    echo ""
    
} > "$REPORT_FILE"

# Copier les fichiers de configuration
echo -e "${YELLOW}📋 Copie des fichiers de configuration...${NC}"
cp backend/config.env "$EXPORT_DIR/" 2>/dev/null || true
cp backend/env.example "$EXPORT_DIR/" 2>/dev/null || true

# Copier les schémas Prisma
if [ -f "backend/prisma/schema.prisma" ]; then
    echo -e "${YELLOW}📋 Copie du schéma Prisma...${NC}"
    cp backend/prisma/schema.prisma "$EXPORT_DIR/"
fi

# Créer un fichier README
cat > "$EXPORT_DIR/README.txt" << 'EOF'
═══════════════════════════════════════════════════════════════
  EXPORT D'INFORMATIONS SUR LA BASE DE DONNÉES GNV
═══════════════════════════════════════════════════════════════

Ce dossier contient:
- Rapport détaillé sur l'état de la base de données
- Fichiers de configuration
- Schéma Prisma (si disponible)

Pour exporter la vraie base de données MongoDB, vous devez:
1. Installer MongoDB ou utiliser MongoDB Atlas
2. Démarrer MongoDB
3. Exécuter: ./export-database.sh

═══════════════════════════════════════════════════════════════
EOF

# Créer une archive et la copier sur le bureau
echo -e "${YELLOW}📦 Création de l'archive...${NC}"
ARCHIVE_NAME="gnv-database-info-$TIMESTAMP.tar.gz"
tar -czf "$ARCHIVE_NAME" -C "$(dirname "$EXPORT_DIR")" "$(basename "$EXPORT_DIR")" 2>/dev/null

# Essayer de copier sur le bureau
if cp "$ARCHIVE_NAME" "$HOME/Desktop/" 2>/dev/null; then
    DESKTOP_ARCHIVE="$HOME/Desktop/$ARCHIVE_NAME"
    echo -e "${GREEN}✅ Archive copiée sur le bureau: $DESKTOP_ARCHIVE${NC}"
    rm -f "$ARCHIVE_NAME"
else
    # Si la copie échoue, garder l'archive dans le projet
    echo -e "${YELLOW}⚠️  Impossible de copier sur le bureau (permissions)${NC}"
    echo -e "${GREEN}✅ Archive créée dans le projet: $(pwd)/$ARCHIVE_NAME${NC}"
    echo -e "${YELLOW}💡 Vous pouvez la copier manuellement sur le bureau${NC}"
fi

echo ""
echo -e "${GREEN}✅ Rapport créé avec succès !${NC}"
echo -e "${GREEN}📁 Dossier: $EXPORT_DIR${NC}"
echo ""
echo -e "${BLUE}💡 Pour exporter la vraie base de données MongoDB:${NC}"
echo "   1. Installez MongoDB: brew install mongodb-community"
echo "   2. Démarrez MongoDB: brew services start mongodb-community"
echo "   3. Exécutez: ./export-database.sh"
