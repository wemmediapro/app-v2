#!/bin/bash

# GNV OnBoard Application - Startup Script
echo "🚀 Démarrage de l'application GNV OnBoard..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez installer Node.js d'abord."
    exit 1
fi

# Check if MongoDB is running
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB n'est pas installé. Veuillez installer MongoDB ou utiliser MongoDB Atlas."
    echo "   Pour installer MongoDB localement:"
    echo "   - macOS: brew install mongodb-community"
    echo "   - Ubuntu: sudo apt-get install mongodb"
    echo "   - Windows: Téléchargez depuis https://www.mongodb.com/try/download/community"
fi

# Install backend dependencies
echo "📦 Installation des dépendances backend..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install
fi

# Install dashboard dependencies
echo "📦 Installation des dépendances dashboard..."
cd ../dashboard
if [ ! -d "node_modules" ]; then
    npm install
fi

# Install frontend dependencies
echo "📦 Installation des dépendances frontend..."
cd ..
if [ ! -d "node_modules" ]; then
    npm install
fi

# Create .env file for backend if it doesn't exist
if [ ! -f "backend/.env" ]; then
    echo "📝 Création du fichier .env pour le backend..."
    cp backend/env.example backend/.env
    echo "✅ Fichier .env créé. Veuillez le configurer avec vos paramètres."
fi

# Create .env file for dashboard if it doesn't exist
if [ ! -f "dashboard/.env" ]; then
    echo "📝 Création du fichier .env pour le dashboard..."
    cat > dashboard/.env << EOF
VITE_API_URL=http://localhost:3000/api
EOF
fi

echo ""
echo "✅ Installation terminée !"
echo ""
echo "🚀 Pour démarrer l'application :"
echo "   1. Backend: cd backend && npm run dev"
echo "   2. Dashboard: cd dashboard && npm run dev"
echo "   3. Frontend: npm run dev"
echo ""
echo "📱 URLs d'accès :"
echo "   - Frontend: http://localhost:5173"
echo "   - Dashboard: http://localhost:3001"
echo "   - Backend API: http://localhost:3000"
echo ""
echo "🔑 Identifiants admin par défaut :"
echo "   - Email: admin@gnv.com"
echo "   - Mot de passe: admin123"
echo ""
echo "📚 Documentation: Voir README.md pour plus d'informations"



