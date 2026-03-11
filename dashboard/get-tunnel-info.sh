#!/bin/bash

# Script pour obtenir les informations du tunnel

echo "🔍 Recherche des informations du tunnel..."
echo ""

# Chercher le processus localtunnel
TUNNEL_PID=$(ps aux | grep -E "localtunnel|lt --port" | grep -v grep | awk '{print $2}')

if [ -z "$TUNNEL_PID" ]; then
    echo "❌ Aucun tunnel actif trouvé"
    echo ""
    echo "💡 Pour démarrer un tunnel, utilisez:"
    echo "   npm run tunnel"
    echo "   ou"
    echo "   npx localtunnel --port 5173"
    exit 1
fi

echo "✅ Tunnel actif trouvé (PID: $TUNNEL_PID)"
echo ""
echo "📋 Informations du tunnel:"
echo "   - URL: https://gnv-dashboard.loca.lt"
echo "   - URL locale: http://localhost:5173"
echo ""
echo "🔑 Le mot de passe du tunnel est affiché dans le terminal où vous avez lancé:"
echo "   npx localtunnel --port 5173"
echo ""
echo "💡 Astuce: Le mot de passe apparaît généralement après 'Tunnel password:'"
echo "   dans les logs du terminal."







