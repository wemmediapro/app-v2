#!/bin/bash

# Script pour obtenir l'URL du tunnel actif

echo "🔍 Recherche de l'URL du tunnel..."
echo ""

# Vérifier si localtunnel est actif
if ! pgrep -f "localtunnel\|lt --port" > /dev/null; then
    echo "❌ Aucun tunnel actif trouvé"
    echo ""
    echo "💡 Pour créer un tunnel, exécutez:"
    echo "   cd dashboard"
    echo "   ./demo-tunnel.sh"
    echo ""
    echo "   ou dans un terminal séparé:"
    echo "   npx localtunnel --port 5173"
    exit 1
fi

echo "✅ Tunnel actif détecté"
echo ""
echo "📱 URL du tunnel: https://gnv-dashboard.loca.lt"
echo "   (ou une URL aléatoire si le subdomain n'est pas disponible)"
echo ""
echo "🏠 URL locale: http://localhost:5173"
echo ""
echo "💡 Pour voir l'URL exacte et le mot de passe,"
echo "   regardez le terminal où vous avez lancé localtunnel"
echo ""
echo "🔑 Le mot de passe apparaît généralement après 'password:'"
echo "   dans les logs du terminal localtunnel"






