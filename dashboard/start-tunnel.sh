#!/bin/bash

# Script pour démarrer le dashboard avec un tunnel

echo "🚀 Démarrage du dashboard GNV avec tunnel..."

# Vérifier si le port 5173 est déjà utilisé
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Le port 5173 est déjà utilisé. Arrêt du processus..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    sleep 2
fi

# Démarrer le serveur de développement
echo "📦 Démarrage du serveur Vite..."
npm run dev:tunnel &
VITE_PID=$!

# Attendre que le serveur démarre
sleep 5

# Vérifier que le serveur est bien démarré
if ! lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ Erreur: Le serveur n'a pas démarré correctement"
    kill $VITE_PID 2>/dev/null
    exit 1
fi

echo "✅ Serveur démarré sur http://localhost:5173"
echo "🌐 Démarrage du tunnel..."

# Démarrer le tunnel
npx localtunnel --port 5173 --subdomain gnv-dashboard 2>&1 | while IFS= read -r line; do
    if [[ $line == *"your url is"* ]]; then
        URL=$(echo "$line" | grep -oP 'https://[^\s]+')
        echo ""
        echo "🎉 Tunnel créé avec succès!"
        echo "📱 URL publique: $URL"
        echo ""
        echo "💡 Vous pouvez maintenant partager cette URL pour la démonstration"
        echo "🛑 Appuyez sur Ctrl+C pour arrêter le tunnel et le serveur"
        echo ""
    else
        echo "$line"
    fi
done

# Nettoyer à l'arrêt
echo "🛑 Arrêt du serveur..."
kill $VITE_PID 2>/dev/null







