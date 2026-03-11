#!/bin/bash

# Script pour lancer toute l'application GNV OnBoard
# Usage: ./start-all.sh [--skip-checks]

set -e

echo "🚀 Démarrage de l'application GNV OnBoard..."
echo ""

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Vérification des prérequis (sauf si --skip-checks)
if [[ "$1" != "--skip-checks" ]]; then
    echo -e "${BLUE}🔍 Vérification des prérequis système...${NC}"
    if [ -f "./check-system-requirements.sh" ]; then
        if ./check-system-requirements.sh development 2>/dev/null; then
            echo -e "${GREEN}✅ Prérequis satisfaits${NC}"
        else
            echo -e "${YELLOW}⚠️  Certains prérequis ne sont pas satisfaits${NC}"
            echo -e "${YELLOW}💡 Pour ignorer cette vérification: ./start-all.sh --skip-checks${NC}"
            read -p "Continuer quand même ? (o/N): " continue_anyway
            if [[ ! $continue_anyway =~ ^[Oo]$ ]]; then
                exit 1
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  Script de vérification non trouvé, poursuite...${NC}"
    fi
    echo ""
fi

# Fonction pour vérifier si un port est utilisé
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${YELLOW}⚠️  Le port $1 est déjà utilisé${NC}"
        return 1
    else
        return 0
    fi
}

# Vérifier les ports
echo "🔍 Vérification des ports..."
check_port 3000 && echo -e "${GREEN}✅ Port 3000 disponible (Backend)${NC}" || echo -e "${RED}❌ Port 3000 occupé${NC}"
check_port 5173 && echo -e "${GREEN}✅ Port 5173 disponible (Frontend)${NC}" || echo -e "${RED}❌ Port 5173 occupé${NC}"
check_port 5174 && echo -e "${GREEN}✅ Port 5174 disponible (Dashboard)${NC}" || echo -e "${RED}❌ Port 5174 occupé${NC}"
echo ""

# Vérifier si les dépendances sont installées
echo "📦 Vérification des dépendances..."

if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Installation des dépendances backend...${NC}"
    cd backend && npm install && cd ..
fi

if [ ! -d "dashboard/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Installation des dépendances dashboard...${NC}"
    cd dashboard && npm install && cd ..
fi

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Installation des dépendances frontend...${NC}"
    npm install
fi

echo -e "${GREEN}✅ Dépendances vérifiées${NC}"
echo ""

# Initialiser la base de données Prisma (optionnel)
read -p "Voulez-vous initialiser la base de données Prisma ? (o/N): " init_db
if [[ $init_db =~ ^[Oo]$ ]]; then
    echo "🗄️  Initialisation de la base de données Prisma..."
    cd backend
    npm run init-db-prisma
    cd ..
    echo ""
fi

# Fonction pour nettoyer les processus à la sortie
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Arrêt des services...${NC}"
    pkill -f "node.*server.js" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    echo -e "${GREEN}✅ Services arrêtés${NC}"
    exit 0
}

# Capturer Ctrl+C pour nettoyer
trap cleanup SIGINT SIGTERM

# Lancer le backend
echo "🔧 Démarrage du backend..."
cd backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..
sleep 3

# Lancer le dashboard
echo "📊 Démarrage du dashboard..."
cd dashboard
npm run dev > ../dashboard.log 2>&1 &
DASHBOARD_PID=$!
cd ..
sleep 3

# Lancer le frontend principal
echo "🌐 Démarrage du frontend..."
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 3

echo ""
echo -e "${GREEN}✅ Tous les services sont démarrés !${NC}"
echo ""
echo "📱 URLs d'accès :"
echo "   - Backend API:    http://localhost:3000"
echo "   - Frontend:       http://localhost:5173"
echo "   - Dashboard:      http://localhost:5174"
echo ""
echo "📋 Logs disponibles dans :"
echo "   - backend.log"
echo "   - dashboard.log"
echo "   - frontend.log"
echo ""
echo -e "${YELLOW}💡 Appuyez sur Ctrl+C pour arrêter tous les services${NC}"
echo ""

# Attendre que les processus se terminent
wait

