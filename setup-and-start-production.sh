#!/bin/bash

# Script complet : Configuration Production + Initialisation BDD + Démarrage
# Usage: ./setup-and-start-production.sh

set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🚀 Configuration PRODUCTION + Initialisation BDD          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Vérifier si config.env existe
if [ ! -f "backend/config.env" ]; then
    echo -e "${YELLOW}⚠️  Création de backend/config.env depuis config.production.env.example...${NC}"
    if [ -f "backend/config.production.env.example" ]; then
        cp backend/config.production.env.example backend/config.env
    elif [ -f "backend/env.example" ]; then
        cp backend/env.example backend/config.env
    else
        echo -e "${RED}❌ Aucun fichier d'exemple trouvé${NC}"
        exit 1
    fi
fi

# Mettre à jour config.env pour la production
echo -e "${BLUE}🔧 Configuration de l'environnement PRODUCTION...${NC}"

# Désactiver le mode démo
sed -i.bak 's/DEMO_MODE=true/DEMO_MODE=false/g' backend/config.env 2>/dev/null || \
sed -i '' 's/DEMO_MODE=true/DEMO_MODE=false/g' backend/config.env 2>/dev/null || true

sed -i.bak 's/FORCE_DEMO=true/FORCE_DEMO=false/g' backend/config.env 2>/dev/null || \
sed -i '' 's/FORCE_DEMO=true/FORCE_DEMO=false/g' backend/config.env 2>/dev/null || true

# Mettre NODE_ENV en production
sed -i.bak 's/NODE_ENV=development/NODE_ENV=production/g' backend/config.env 2>/dev/null || \
sed -i '' 's/NODE_ENV=development/NODE_ENV=production/g' backend/config.env 2>/dev/null || true

# Mettre PORT à 3000 si c'est 3001
sed -i.bak 's/PORT=3001/PORT=3000/g' backend/config.env 2>/dev/null || \
sed -i '' 's/PORT=3001/PORT=3000/g' backend/config.env 2>/dev/null || true

# Ajouter PORT si absent
if ! grep -q "^PORT=" backend/config.env; then
    echo "PORT=3000" >> backend/config.env
fi

# Ajouter NODE_ENV si absent
if ! grep -q "^NODE_ENV=" backend/config.env; then
    echo "NODE_ENV=production" >> backend/config.env
fi

echo -e "${GREEN}✅ Configuration mise à jour${NC}"
echo ""

# Vérifier MongoDB
echo -e "${BLUE}🔍 Vérification de MongoDB...${NC}"

MONGODB_URI=$(grep "^MONGODB_URI=" backend/config.env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")

if [ -z "$MONGODB_URI" ]; then
    echo -e "${YELLOW}⚠️  MONGODB_URI non configuré dans config.env${NC}"
    echo -e "${YELLOW}💡 Configuration par défaut: mongodb://localhost:27017/gnv_onboard${NC}"
    MONGODB_URI="mongodb://localhost:27017/gnv_onboard"
fi

# Vérifier si c'est MongoDB Atlas ou local
if [[ "$MONGODB_URI" == *"mongodb+srv://"* ]] || [[ "$MONGODB_URI" == *"mongodb.net"* ]]; then
    echo -e "${GREEN}✅ MongoDB Atlas détecté${NC}"
    MONGODB_TYPE="atlas"
else
    echo -e "${YELLOW}ℹ️  MongoDB local configuré${NC}"
    MONGODB_TYPE="local"
    
    # Vérifier si MongoDB est installé
    if ! command -v mongod &> /dev/null && ! command -v mongosh &> /dev/null; then
        echo -e "${YELLOW}⚠️  MongoDB n'est pas installé localement${NC}"
        echo -e "${YELLOW}💡 Options:${NC}"
        echo "   1. Installer MongoDB localement"
        echo "   2. Utiliser MongoDB Atlas (cloud)"
        echo ""
        read -p "Voulez-vous installer MongoDB localement maintenant ? (o/N): " install_mongo
        if [[ $install_mongo =~ ^[Oo]$ ]]; then
            echo -e "${BLUE}📦 Installation de MongoDB...${NC}"
            if command -v brew &> /dev/null; then
                brew tap mongodb/brew
                brew install mongodb-community
                brew services start mongodb-community
                echo -e "${GREEN}✅ MongoDB installé et démarré${NC}"
            else
                echo -e "${RED}❌ Homebrew n'est pas installé. Installez MongoDB manuellement.${NC}"
                exit 1
            fi
        else
            echo -e "${YELLOW}⚠️  Continuons sans MongoDB local. Utilisez MongoDB Atlas ou activez DEMO_MODE.${NC}"
        fi
    else
        # Vérifier si MongoDB est démarré
        if pgrep -x mongod > /dev/null || pgrep -f mongod > /dev/null; then
            echo -e "${GREEN}✅ MongoDB est démarré${NC}"
        else
            echo -e "${YELLOW}⚠️  MongoDB n'est pas démarré. Tentative de démarrage...${NC}"
            if command -v brew &> /dev/null; then
                brew services start mongodb-community 2>/dev/null || \
                mongod --fork --logpath /tmp/mongod.log 2>/dev/null || \
                echo -e "${YELLOW}⚠️  Impossible de démarrer MongoDB automatiquement${NC}"
            fi
        fi
    fi
fi

echo ""

# Installer les dépendances
echo -e "${BLUE}📦 Installation des dépendances...${NC}"

if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}  → Installation backend...${NC}"
    cd backend
    npm install
    cd ..
fi

if [ ! -d "dashboard/node_modules" ]; then
    echo -e "${YELLOW}  → Installation dashboard...${NC}"
    cd dashboard
    npm install
    cd ..
fi

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}  → Installation frontend...${NC}"
    npm install
fi

echo -e "${GREEN}✅ Dépendances installées${NC}"
echo ""

# Initialiser la base de données
echo -e "${BLUE}🗄️  Initialisation de la base de données...${NC}"

cd backend

# Tester la connexion MongoDB
echo -e "${YELLOW}  → Test de connexion à MongoDB...${NC}"

node -e "
require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gnv_onboard';
mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log('✅ Connexion MongoDB réussie');
    mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.log('❌ Connexion MongoDB échouée:', err.message);
    console.log('💡 Vérifiez votre configuration MONGODB_URI dans config.env');
    process.exit(1);
  });
" 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Connexion MongoDB OK${NC}"
    echo ""
    echo -e "${YELLOW}  → Exécution du script d'initialisation...${NC}"
    
    if npm run init-db 2>&1; then
        echo -e "${GREEN}✅ Base de données initialisée avec succès${NC}"
    else
        echo -e "${YELLOW}⚠️  Erreur lors de l'initialisation, mais continuons...${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Impossible de se connecter à MongoDB${NC}"
    echo -e "${YELLOW}💡 Options:${NC}"
    echo "   1. Vérifiez que MongoDB est démarré"
    echo "   2. Vérifiez MONGODB_URI dans backend/config.env"
    echo "   3. Activez DEMO_MODE=true pour utiliser le mode démo"
    echo ""
    read -p "Voulez-vous continuer avec DEMO_MODE ? (o/N): " use_demo
    if [[ $use_demo =~ ^[Oo]$ ]]; then
        sed -i.bak 's/DEMO_MODE=false/DEMO_MODE=true/g' config.env 2>/dev/null || \
        sed -i '' 's/DEMO_MODE=false/DEMO_MODE=true/g' config.env 2>/dev/null || true
        echo "DEMO_MODE=true" >> config.env
        echo -e "${GREEN}✅ Mode démo activé${NC}"
    fi
fi

cd ..
echo ""

# Build des applications
echo -e "${BLUE}🔨 Build des applications frontend...${NC}"

echo -e "${YELLOW}  → Build frontend principal...${NC}"
npm run build 2>&1 | head -20

echo -e "${YELLOW}  → Build dashboard...${NC}"
cd dashboard && npm run build 2>&1 | head -20 && cd ..

echo -e "${GREEN}✅ Build terminé${NC}"
echo ""

# Vérifier PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 n'est pas installé. Installation...${NC}"
    npm install -g pm2
    echo -e "${GREEN}✅ PM2 installé${NC}"
fi

# Créer le dossier logs
mkdir -p logs

# Arrêter les instances existantes
echo -e "${BLUE}🛑 Arrêt des instances PM2 existantes...${NC}"
pm2 delete all 2>/dev/null || true
sleep 2

# Démarrer avec PM2
echo -e "${BLUE}🚀 Démarrage en mode PRODUCTION...${NC}"
pm2 start ecosystem.config.js --env production

# Sauvegarder
pm2 save

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Application démarrée en mode PRODUCTION              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Afficher le statut
pm2 status

echo ""
echo -e "${BLUE}🌐 URLs d'accès:${NC}"
echo "   - Backend API:    http://localhost:3000"
echo "   - Frontend:       http://localhost:5173"
echo "   - Dashboard:      http://localhost:5174"
echo "   - Health Check:   http://localhost:3000/api/health"
echo ""

# Afficher les identifiants admin
echo -e "${BLUE}🔑 Identifiants par défaut:${NC}"
echo "   Email:    admin@gnv.com"
echo "   Password: admin123"
echo ""

echo -e "${YELLOW}💡 Commandes utiles:${NC}"
echo "   - pm2 logs          : Voir les logs"
echo "   - pm2 monit         : Monitoring"
echo "   - pm2 restart all   : Redémarrer"
echo "   - pm2 stop all      : Arrêter"
echo ""
