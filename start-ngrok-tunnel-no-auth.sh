#!/bin/bash

# Script pour démarrer le tunnel ngrok SANS authentification (pour tester)

export NGROK_AUTH_TOKEN='35Nq9utRoqcximJfj3ZKwUmLxEa_82pJABufoWAenkbPWxDzH'

PORT=5173

echo "🚀 Démarrage du tunnel ngrok (sans authentification)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 URL locale:    http://localhost:$PORT"
echo "⚠️  Note: Ce tunnel n'a PAS de mot de passe"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Vérifier si le serveur Vite est en cours d'exécution
if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Le serveur Vite n'est pas actif sur le port $PORT"
    echo "💡 Démarrez-le avec: npm run dev"
    echo ""
fi

# Arrêter les anciens tunnels
pkill -f "ngrok.*5173" 2>/dev/null
sleep 2

# Démarrer ngrok SANS authentification
echo "🔗 Création du tunnel..."
npx ngrok http $PORT
