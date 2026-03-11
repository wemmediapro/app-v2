#!/bin/bash

# Script pour obtenir l'URL publique du frontend

echo "🔍 Recherche de l'URL publique..."
echo ""

# Vérifier si localtunnel tourne
if lsof -Pi :4040 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Tunnel localtunnel détecté"
    echo ""
    echo "🌐 URL publique:"
    curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"[^"]*"' | sed 's/"public_url":"//;s/"//' | head -1
    echo ""
elif lsof -Pi :4040 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Tunnel ngrok détecté"
    echo ""
    echo "🌐 URL publique:"
    curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"[^"]*"' | sed 's/"public_url":"//;s/"//' | head -1
    echo ""
else
    echo "⚠️  Aucun tunnel détecté"
    echo ""
    echo "Pour créer un tunnel, exécutez:"
    echo "  npm run expose"
    echo "  ou"
    echo "  ./expose-frontend.sh"
    echo ""
fi


