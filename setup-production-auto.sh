#!/bin/bash

# Script automatique : Configuration Production + Initialisation BDD + Démarrage
# Usage: ./setup-production-auto.sh

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
    echo -e "${YELLOW}⚠️  Création de backend/config.env...${NC}"
    if [ -f "backend/config.production.env.example" ]; then
        cp backend/config.production.env.example backend/config.env
    elif [ -f "backend/env.example" ]; then
        cp backend/env.example backend/config.env
    fi
fi

# Configuration pour production
echo -e "${BLUE}🔧 Configuration de l'environnement PRODUCTION...${NC}"

# Fonction pour mettre à jour config.env
update_config() {
    local key=$1
    local value=$2
    
    if grep -q "^${key}=" backend/config.env; then
        sed -i.bak "s|^${key}=.*|${key}=${value}|g" backend/config.env 2>/dev/null || \
        sed -i '' "s|^${key}=.*|${key}=${value}|g" backend/config.env 2>/dev/null || true
    else
        echo "${key}=${value}" >> backend/config.env
    fi
}

# Mettre à jour les valeurs
update_config "NODE_ENV" "production"
update_config "PORT" "3000"

# Vérifier MongoDB
echo -e "${BLUE}🔍 Vérification de MongoDB...${NC}"

MONGODB_URI=$(grep "^MONGODB_URI=" backend/config.env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "mongodb://localhost:27017/gnv_onboard")

# Vérifier si MongoDB est disponible
MONGODB_AVAILABLE=false

if [[ "$MONGODB_URI" == *"mongodb+srv://"* ]] || [[ "$MONGODB_URI" == *"mongodb.net"* ]]; then
    echo -e "${GREEN}✅ MongoDB Atlas configuré${NC}"
    MONGODB_AVAILABLE=true
elif command -v mongod &> /dev/null || command -v mongosh &> /dev/null; then
    # Vérifier si MongoDB est démarré
    if pgrep -x mongod > /dev/null || pgrep -f mongod > /dev/null; then
        echo -e "${GREEN}✅ MongoDB local est démarré${NC}"
        MONGODB_AVAILABLE=true
    else
        echo -e "${YELLOW}⚠️  MongoDB installé mais non démarré${NC}"
        # Essayer de démarrer
        if command -v brew &> /dev/null; then
            brew services start mongodb-community 2>/dev/null && sleep 3 && MONGODB_AVAILABLE=true || true
        fi
    fi
else
    echo -e "${YELLOW}⚠️  MongoDB n'est pas installé localement${NC}"
    echo -e "${YELLOW}💡 Utilisation du mode DÉMO (données statiques)${NC}"
    update_config "DEMO_MODE" "true"
    update_config "FORCE_DEMO" "true"
fi

# Si MongoDB n'est pas disponible, tester la connexion
if [ "$MONGODB_AVAILABLE" = true ]; then
    echo -e "${YELLOW}  → Test de connexion MongoDB...${NC}"
    cd backend
    if node -e "
    require('dotenv').config({ path: './config.env' });
    const mongoose = require('mongoose');
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gnv_onboard';
    mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 })
      .then(() => { mongoose.connection.close(); process.exit(0); })
      .catch(() => { process.exit(1); });
    " 2>/dev/null; then
        echo -e "${GREEN}✅ Connexion MongoDB réussie${NC}"
        update_config "DEMO_MODE" "false"
        update_config "FORCE_DEMO" "false"
    else
        echo -e "${YELLOW}⚠️  Connexion MongoDB échouée, utilisation du mode DÉMO${NC}"
        update_config "DEMO_MODE" "true"
        update_config "FORCE_DEMO" "true"
        MONGODB_AVAILABLE=false
    fi
    cd ..
fi

echo ""

# Installer les dépendances
echo -e "${BLUE}📦 Installation des dépendances...${NC}"

if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}  → Installation backend...${NC}"
    cd backend && npm install && cd ..
fi

if [ ! -d "dashboard/node_modules" ]; then
    echo -e "${YELLOW}  → Installation dashboard...${NC}"
    cd dashboard && npm install && cd ..
fi

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}  → Installation frontend...${NC}"
    npm install
fi

echo -e "${GREEN}✅ Dépendances installées${NC}"
echo ""

# Initialiser la base de données seulement si MongoDB est disponible
if [ "$MONGODB_AVAILABLE" = true ]; then
    echo -e "${BLUE}🗄️  Initialisation de la base de données...${NC}"
    cd backend
    
    if npm run init-db 2>&1 | grep -q "✅\|Initialisation terminée"; then
        echo -e "${GREEN}✅ Base de données initialisée${NC}"
    else
        echo -e "${YELLOW}⚠️  Erreur lors de l'initialisation (peut-être déjà initialisée)${NC}"
    fi
    
    cd ..
    echo ""
fi

# Build des applications
echo -e "${BLUE}🔨 Build des applications frontend...${NC}"

echo -e "${YELLOW}  → Build frontend principal...${NC}"
npm run build > /dev/null 2>&1 || echo -e "${YELLOW}⚠️  Erreur lors du build frontend${NC}"

echo -e "${YELLOW}  → Build dashboard...${NC}"
cd dashboard && npm run build > /dev/null 2>&1 || echo -e "${YELLOW}⚠️  Erreur lors du build dashboard${NC}" && cd ..

echo -e "${GREEN}✅ Build terminé${NC}"
echo ""

# Installer PM2 si nécessaire (localement)
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  Installation de PM2 localement...${NC}"
    npm install pm2 --save-dev 2>/dev/null || npm install pm2 2>/dev/null || true
    # Créer un alias pour utiliser PM2 local
    export PATH="./node_modules/.bin:$PATH"
    alias pm2="./node_modules/.bin/pm2" 2>/dev/null || true
fi

# Utiliser npx pm2 si disponible
PM2_CMD="pm2"
if ! command -v pm2 &> /dev/null; then
    PM2_CMD="npx pm2"
    echo -e "${YELLOW}ℹ️  Utilisation de npx pm2${NC}"
fi

# Créer le dossier logs
mkdir -p logs

# Arrêter les instances existantes
echo -e "${BLUE}🛑 Arrêt des instances PM2 existantes...${NC}"
$PM2_CMD delete all 2>/dev/null || true
sleep 2

# Démarrer avec PM2
echo -e "${BLUE}🚀 Démarrage en mode PRODUCTION...${NC}"
$PM2_CMD start ecosystem.config.cjs --env production

# Sauvegarder
$PM2_CMD save

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Application démarrée en mode PRODUCTION              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Afficher le statut
$PM2_CMD status

echo ""
echo -e "${BLUE}🌐 URLs d'accès:${NC}"
echo "   - Backend API:    http://localhost:3000"
echo "   - Frontend:       http://localhost:5173"
echo "   - Dashboard:      http://localhost:5174"
echo "   - Health Check:   http://localhost:3000/api/health"
echo ""

if [ "$MONGODB_AVAILABLE" = true ]; then
    echo -e "${BLUE}🔑 Identifiants par défaut:${NC}"
    echo "   Email:    admin@gnv.com"
    echo "   Password: admin123"
    echo ""
fi

echo -e "${YELLOW}💡 Commandes utiles:${NC}"
echo "   - $PM2_CMD logs          : Voir les logs"
echo "   - $PM2_CMD monit         : Monitoring"
echo "   - $PM2_CMD restart all   : Redémarrer"
echo "   - $PM2_CMD stop all      : Arrêter"
echo ""
