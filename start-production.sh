#!/bin/bash

# Script de démarrage PRODUCTION pour GNV OnBoard
# Optimisé pour 2000 connexions simultanées
# Usage: ./start-production.sh

set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🚀 GNV OnBoard - Mode PRODUCTION                        ║${NC}"
echo -e "${BLUE}║  Optimisé pour 2000+ connexions simultanées              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Vérifier si PM2 est installé
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 n'est pas installé. Installation...${NC}"
    npm install -g pm2
    echo -e "${GREEN}✅ PM2 installé${NC}"
fi

# Créer le dossier logs s'il n'existe pas
mkdir -p logs

# Vérifier les dépendances
echo -e "${BLUE}📦 Vérification des dépendances...${NC}"

if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Installation des dépendances backend...${NC}"
    cd backend && npm install --production && cd ..
fi

if [ ! -d "dashboard/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Installation des dépendances dashboard...${NC}"
    cd dashboard && npm install --production && cd ..
fi

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Installation des dépendances frontend...${NC}"
    npm install --production
fi

echo -e "${GREEN}✅ Dépendances vérifiées${NC}"
echo ""

# Vérifier le fichier de configuration
if [ ! -f "backend/config.env" ]; then
    echo -e "${YELLOW}⚠️  Le fichier backend/config.env n'existe pas${NC}"
    echo -e "${YELLOW}💡 Création depuis env.example...${NC}"
    if [ -f "backend/env.example" ]; then
        cp backend/env.example backend/config.env
        echo -e "${YELLOW}⚠️  Veuillez configurer backend/config.env avant de continuer${NC}"
        exit 1
    else
        echo -e "${RED}❌ Impossible de trouver env.example${NC}"
        exit 1
    fi
fi

# Build des applications frontend
echo -e "${BLUE}🔨 Build des applications frontend...${NC}"

echo -e "${YELLOW}  → Build frontend principal...${NC}"
npm run build

echo -e "${YELLOW}  → Build dashboard...${NC}"
cd dashboard && npm run build && cd ..

echo -e "${GREEN}✅ Build terminé${NC}"
echo ""

# Vérifier les ports
echo -e "${BLUE}🔍 Vérification des ports...${NC}"

check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${YELLOW}⚠️  Le port $1 est déjà utilisé${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Port $1 disponible${NC}"
        return 0
    fi
}

check_port 3000
check_port 5173
check_port 5174
echo ""

# Arrêter les instances PM2 existantes
echo -e "${BLUE}🛑 Arrêt des instances PM2 existantes...${NC}"
pm2 delete all 2>/dev/null || true
sleep 2

# Démarrer avec PM2
echo -e "${BLUE}🚀 Démarrage avec PM2 (mode cluster)...${NC}"
pm2 start ecosystem.config.js --env production

# Sauvegarder la configuration PM2
pm2 save

# Afficher le statut
echo ""
echo -e "${GREEN}✅ Application démarrée en mode PRODUCTION${NC}"
echo ""
echo -e "${BLUE}📊 Statut des processus:${NC}"
pm2 status
echo ""

# Afficher les logs
echo -e "${BLUE}📋 Logs en temps réel (Ctrl+C pour quitter):${NC}"
echo -e "${YELLOW}💡 Commandes utiles:${NC}"
echo "   - pm2 logs          : Voir tous les logs"
echo "   - pm2 logs gnv-backend : Logs du backend uniquement"
echo "   - pm2 monit         : Monitoring en temps réel"
echo "   - pm2 restart all  : Redémarrer tous les processus"
echo "   - pm2 stop all     : Arrêter tous les processus"
echo "   - pm2 delete all   : Supprimer tous les processus"
echo ""

# Afficher les URLs
echo -e "${BLUE}🌐 URLs d'accès:${NC}"
echo "   - Backend API:    http://localhost:3000"
echo "   - Frontend:       http://localhost:5173"
echo "   - Dashboard:      http://localhost:5174"
echo "   - Health Check:   http://localhost:3000/api/health"
echo ""

# Afficher les informations de capacité
CPU_COUNT=$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo "4")
ESTIMATED_CAPACITY=$((CPU_COUNT * 500))
echo -e "${BLUE}💪 Capacité estimée:${NC}"
echo "   - Workers:        $CPU_COUNT"
echo "   - Connexions:     ~$ESTIMATED_CAPACITY simultanées"
echo ""

# Option pour voir les logs
read -p "Voulez-vous voir les logs maintenant ? (o/N): " show_logs
if [[ $show_logs =~ ^[Oo]$ ]]; then
    pm2 logs
fi
