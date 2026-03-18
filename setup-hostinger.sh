#!/bin/bash
# Script de configuration initiale pour Hostinger
# Exécutez ce script UNE SEULE FOIS pour configurer votre serveur

set -e

echo "🔧 Configuration initiale pour Hostinger"
echo "========================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Vérifications préalables
echo -e "${YELLOW}Vérification des prérequis...${NC}"

if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git n'est pas installé${NC}"
    echo "   Contactez le support Hostinger pour installer Git"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js n'est pas installé${NC}"
    echo "   Installez Node.js via cPanel > Node.js Selector"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm n'est pas installé${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Git: $(git --version)${NC}"
echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
echo -e "${GREEN}✅ npm: $(npm --version)${NC}"
echo ""

# Demander la configuration
read -p "Chemin de déploiement (ex: ~/domains/votre-domaine.com/public_html/api): " DEPLOY_PATH
DEPLOY_DIR=$(eval echo "$DEPLOY_PATH")

if [ -z "$DEPLOY_DIR" ]; then
    echo -e "${RED}❌ Chemin invalide${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Dossier de déploiement: $DEPLOY_DIR"
echo ""

read -p "Continuer? (o/n): " CONFIRM
if [ "$CONFIRM" != "o" ] && [ "$CONFIRM" != "O" ]; then
    echo "Annulé"
    exit 0
fi

# Créer le répertoire
echo -e "${YELLOW}📁 Création du répertoire...${NC}"
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Cloner le repository
echo -e "${YELLOW}📥 Clonage du repository...${NC}"
if [ -d ".git" ]; then
    echo "Repository déjà cloné, mise à jour..."
    git pull origin main
else
    git clone -b main "${REPO_URL:-https://github.com/wemmediapro/app-v2.git}" .
fi

# Aller dans le dossier backend
cd "$BACKEND_DIR"

# Installer les dépendances
echo -e "${YELLOW}📦 Installation des dépendances...${NC}"
npm install --production

# Créer le fichier config.env s'il n'existe pas
if [ ! -f "config.env" ]; then
    echo -e "${YELLOW}📝 Création du fichier config.env...${NC}"
    cp env.example config.env
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: Éditez config.env avec vos valeurs:${NC}"
    echo "   nano config.env"
    echo ""
    read -p "Appuyez sur Entrée après avoir configuré config.env..."
fi

# Créer les dossiers nécessaires
echo -e "${YELLOW}📁 Création des dossiers...${NC}"
mkdir -p public/uploads
mkdir -p logs
chmod 755 public/uploads

# Installer PM2 si ce n'est pas déjà fait
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Installation de PM2...${NC}"
    npm install -g pm2
else
    echo -e "${GREEN}✅ PM2 déjà installé${NC}"
fi

# Copier et configurer deploy.sh
echo -e "${YELLOW}📝 Configuration du script de déploiement...${NC}"
cd "$DEPLOY_DIR"
if [ -f "deploy.sh" ]; then
    # Modifier le DEPLOY_DIR dans deploy.sh
    sed -i "s|DEPLOY_DIR=.*|DEPLOY_DIR=\"$DEPLOY_DIR\"|" deploy.sh
    chmod +x deploy.sh
    echo -e "${GREEN}✅ Script deploy.sh configuré${NC}"
fi

# Résumé
echo ""
echo -e "${GREEN}✅ Configuration terminée!${NC}"
echo ""
echo "Prochaines étapes:"
echo "1. Éditez config.env: nano $DEPLOY_DIR/$BACKEND_DIR/config.env"
echo "2. Démarrez l'application:"
echo "   cd $DEPLOY_DIR/$BACKEND_DIR"
echo "   pm2 start server.js --name gnv-backend"
echo "   pm2 save"
echo ""
echo "3. Configurez le webhook GitHub (optionnel):"
echo "   - Copiez webhook.php dans public_html"
echo "   - Configurez dans GitHub > Settings > Webhooks"
echo ""


