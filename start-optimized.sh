#!/bin/bash

# Script de démarrage optimisé pour 2000 connexions simultanées
# Usage: ./start-optimized.sh

set -e

echo "🚀 Démarrage optimisé pour 2000 connexions simultanées"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Vérifier les prérequis
echo -e "${BLUE}🔍 Vérification des prérequis...${NC}"

# Vérifier PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 n'est pas installé${NC}"
    echo "Installation de PM2..."
    npm install -g pm2
fi

# Vérifier Redis
if ! command -v redis-cli &> /dev/null; then
    echo -e "${YELLOW}⚠️  Redis n'est pas installé${NC}"
    echo "Redis est recommandé pour le clustering Socket.io"
    read -p "Continuer sans Redis ? (o/N): " continue_without_redis
    if [[ ! $continue_without_redis =~ ^[Oo]$ ]]; then
        exit 1
    fi
else
    # Vérifier que Redis est démarré
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}✅ Redis est démarré${NC}"
    else
        echo -e "${YELLOW}⚠️  Redis n'est pas démarré${NC}"
        echo "Démarrage de Redis..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            brew services start redis || echo "Impossible de démarrer Redis"
        else
            sudo systemctl start redis || echo "Impossible de démarrer Redis"
        fi
    fi
fi

# Vérifier MongoDB (optionnel si mode démo)
if ! command -v mongod &> /dev/null; then
    echo -e "${YELLOW}⚠️  MongoDB n'est pas installé (mode démo disponible)${NC}"
else
    if mongosh --eval "db.adminCommand('ping')" --quiet &> /dev/null; then
        echo -e "${GREEN}✅ MongoDB est démarré${NC}"
    else
        echo -e "${YELLOW}⚠️  MongoDB n'est pas démarré${NC}"
    fi
fi

echo ""

# Vérifier les dépendances
echo -e "${BLUE}📦 Vérification des dépendances...${NC}"

if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}Installation des dépendances backend...${NC}"
    cd backend && npm install && cd ..
fi

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installation des dépendances frontend...${NC}"
    npm install
fi

echo -e "${GREEN}✅ Dépendances vérifiées${NC}"
echo ""

# Vérifier la configuration
if [ ! -f "backend/config.env" ]; then
    echo -e "${RED}❌ Fichier backend/config.env introuvable${NC}"
    echo "Création depuis env.example..."
    cp backend/env.example backend/config.env
    echo -e "${YELLOW}⚠️  Veuillez configurer backend/config.env${NC}"
fi

# Créer le dossier logs
mkdir -p logs

echo ""
echo -e "${BLUE}🚀 Démarrage avec PM2...${NC}"

# Arrêter les instances existantes
pm2 delete gnv-backend 2>/dev/null || true
pm2 delete gnv-frontend 2>/dev/null || true
pm2 delete gnv-dashboard 2>/dev/null || true

# Démarrer avec PM2
pm2 start ecosystem.config.cjs --env production

# Sauvegarder la configuration PM2
pm2 save

# Afficher le statut
echo ""
echo -e "${GREEN}✅ Application démarrée !${NC}"
echo ""
echo "📊 Statut PM2:"
pm2 status

echo ""
echo "📱 URLs d'accès:"
echo "   - Backend API:    http://localhost:3000"
echo "   - Frontend:       http://localhost:5173"
echo "   - Dashboard:      http://localhost:5174"
echo "   - Health Check:   http://localhost:3000/api/health"
echo ""
echo "🔧 Commandes utiles:"
echo "   - Voir les logs:     pm2 logs"
echo "   - Monitoring:        pm2 monit"
echo "   - Redémarrer:        pm2 restart all"
echo "   - Arrêter:           pm2 stop all"
echo ""
echo -e "${BLUE}💡 Pour voir les statistiques de connexions:${NC}"
echo "   curl http://localhost:3000/api/health"
echo ""
