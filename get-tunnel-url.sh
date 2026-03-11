#!/bin/bash

# Script pour obtenir l'URL du tunnel localtunnel

echo "🔍 Recherche de l'URL du tunnel..."

# Chercher dans les processus locaux
LT_PID=$(ps aux | grep "lt --port 5173" | grep -v grep | awk '{print $2}' | head -1)

if [ -z "$LT_PID" ]; then
    echo "❌ Aucun tunnel localtunnel trouvé sur le port 5173"
    echo "💡 Démarrez le tunnel avec: npx localtunnel --port 5173"
    exit 1
fi

echo "✅ Tunnel trouvé (PID: $LT_PID)"
echo ""
echo "📋 L'URL du tunnel devrait être affichée dans le terminal où vous avez lancé:"
echo "   npx localtunnel --port 5173"
echo ""
echo "💡 L'URL suit généralement ce format:"
echo "   https://xxxxx.loca.lt"
echo ""
echo "🌐 Votre frontend local est accessible sur: http://localhost:5173"
