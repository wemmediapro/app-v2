#!/bin/bash
# Script de déploiement pour Hostinger
# Usage: ./deploy.sh ou via webhook GitHub
# 
# IMPORTANT: Modifiez DEPLOY_DIR selon votre structure Hostinger:
# - Sous-dossier API: $HOME/domains/votre-domaine.com/public_html/api
# - Sous-domaine API: $HOME/domains/api.votre-domaine.com/public_html

set -e  # Arrêter en cas d'erreur

echo "🚀 Démarrage du déploiement..."

# Configuration - MODIFIEZ CES VARIABLES SELON VOTRE CONFIGURATION
REPO_URL="https://github.com/wemmediapro/app-v2.git"
BRANCH="main"
BACKEND_DIR="backend"

# MODIFIEZ CETTE LIGNE selon votre structure Hostinger:
# Option 1: Sous-dossier API
DEPLOY_DIR="$HOME/domains/votre-domaine.com/public_html/api"
# Option 2: Sous-domaine API (décommentez la ligne suivante)
# DEPLOY_DIR="$HOME/domains/api.votre-domaine.com/public_html"

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier si Git est installé
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git n'est pas installé${NC}"
    exit 1
fi

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js n'est pas installé${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Git et Node.js sont installés${NC}"

# Créer le répertoire de déploiement s'il n'existe pas
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Cloner ou mettre à jour le repository
if [ -d ".git" ]; then
    echo -e "${YELLOW}📥 Mise à jour du repository...${NC}"
    git fetch origin
    git reset --hard origin/$BRANCH
    git clean -fd
else
    echo -e "${YELLOW}📥 Clonage du repository...${NC}"
    git clone -b $BRANCH $REPO_URL .
fi

# Aller dans le dossier backend
cd "$BACKEND_DIR"

# Sauvegarder le fichier config.env s'il existe
if [ -f "config.env" ]; then
    echo -e "${YELLOW}💾 Sauvegarde de config.env...${NC}"
    cp config.env config.env.backup
fi

# Installer les dépendances
echo -e "${YELLOW}📦 Installation des dépendances...${NC}"
npm ci --production

# Restaurer config.env
if [ -f "config.env.backup" ]; then
    echo -e "${YELLOW}📥 Restauration de config.env...${NC}"
    mv config.env.backup config.env
fi

# Créer les dossiers nécessaires
mkdir -p public/uploads
mkdir -p logs

# Vérifier si PM2 est installé (pour gérer le processus Node.js)
if command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}🔄 Redémarrage avec PM2...${NC}"
    pm2 restart gnv-backend || pm2 start server.js --name gnv-backend
    pm2 save
else
    echo -e "${YELLOW}⚠️  PM2 n'est pas installé. Installez-le avec: npm install -g pm2${NC}"
    echo -e "${YELLOW}   Le serveur devra être redémarré manuellement${NC}"
fi

echo -e "${GREEN}✅ Déploiement terminé avec succès!${NC}"
echo -e "${GREEN}📊 Vérifiez les logs avec: pm2 logs gnv-backend${NC}"

