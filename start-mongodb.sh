#!/bin/bash

# Script de démarrage MongoDB pour GNV OnBoard

echo "🔍 Vérification de MongoDB..."

# Vérifier si MongoDB est installé
if command -v mongod &> /dev/null; then
    echo "✅ MongoDB trouvé"
    
    # Vérifier si MongoDB est déjà démarré
    if pgrep -x mongod > /dev/null; then
        echo "✅ MongoDB est déjà démarré"
        exit 0
    fi
    
    # Essayer de démarrer MongoDB
    echo "🚀 Démarrage de MongoDB..."
    
    # macOS avec Homebrew
    if command -v brew &> /dev/null; then
        brew services start mongodb-community 2>/dev/null || brew services start mongodb/brew/mongodb-community 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "✅ MongoDB démarré avec Homebrew"
            exit 0
        fi
    fi
    
    # Démarrer directement
    mongod --dbpath ~/data/db 2>/dev/null &
    if [ $? -eq 0 ]; then
        echo "✅ MongoDB démarré"
        exit 0
    fi
    
    echo "❌ Impossible de démarrer MongoDB automatiquement"
    echo "💡 Essayez manuellement :"
    echo "   - macOS (Homebrew): brew services start mongodb-community"
    echo "   - Linux: sudo systemctl start mongodb"
    echo "   - Ou utilisez MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas"
    
else
    echo "❌ MongoDB n'est pas installé"
    echo ""
    echo "📦 Options d'installation :"
    echo ""
    echo "Option 1: MongoDB Atlas (Cloud - Recommandé et Gratuit)"
    echo "   1. Créer un compte: https://www.mongodb.com/cloud/atlas"
    echo "   2. Créer un cluster gratuit (M0)"
    echo "   3. Copier la connection string"
    echo "   4. L'ajouter dans backend/config.env"
    echo ""
    echo "Option 2: Installation locale"
    echo "   macOS: brew install mongodb-community"
    echo "   Linux: sudo apt-get install mongodb"
    echo "   Windows: Télécharger depuis https://www.mongodb.com/try/download/community"
    echo ""
    echo "💡 Pour l'instant, l'application fonctionnera sans MongoDB"
    echo "   mais certaines fonctionnalités seront limitées."
fi


