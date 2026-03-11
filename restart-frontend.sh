#!/bin/bash

# Script pour redémarrer le frontend avec la nouvelle configuration

echo "🔄 Redémarrage du frontend..."

# Trouver et arrêter le processus Vite sur le port 5173
PID=$(lsof -ti:5173 2>/dev/null)
if [ ! -z "$PID" ]; then
    echo "⏹️  Arrêt du processus Vite (PID: $PID)..."
    kill $PID 2>/dev/null
    sleep 2
fi

# Attendre que le port soit libéré
while lsof -ti:5173 >/dev/null 2>&1; do
    echo "⏳ Attente de la libération du port 5173..."
    sleep 1
done

echo "✅ Port 5173 libéré"
echo ""
echo "🚀 Démarrage du serveur Vite..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Le frontend sera accessible sur: http://localhost:5173"
echo "🔗 Le tunnel ngrok continuera de fonctionner"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Démarrer Vite
npm run dev
