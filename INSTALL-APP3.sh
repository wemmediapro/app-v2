#!/bin/bash

echo "🚀 Installation de l'application GNV OnBoard - App3"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

echo "✅ Node.js $(node --version) détecté"
echo ""

# Installer les dépendances Backend
echo "📦 Installation des dépendances Backend..."
cd backend
npm install
echo ""

# Installer les dépendances Frontend
echo "📦 Installation des dépendances Frontend..."
cd ..
npm install
echo ""

# Installer les dépendances Dashboard
echo "📦 Installation des dépendances Dashboard..."
cd dashboard
npm install
cd ..
echo ""

# Générer le client Prisma
echo "🔧 Génération du client Prisma..."
cd backend
npx prisma generate
cd ..
echo ""

# Configuration de la base de données
echo "🗄️ Configuration de la base de données..."
if [ ! -f "backend/config.env" ]; then
    echo "📝 Création du fichier config.env..."
    cp backend/env.example backend/config.env 2>/dev/null || echo "MONGODB_URI=mongodb://localhost:27017/gnv_onboard" > backend/config.env
fi

echo ""
echo "✅ Installation terminée!"
echo ""
echo "📋 Prochaines étapes:"
echo "1. Configurez MongoDB dans backend/config.env"
echo "2. Initialisez la base de données: cd backend && node scripts/init-database.js"
echo "3. Démarrez l'application: ./start-all.sh"
echo ""
