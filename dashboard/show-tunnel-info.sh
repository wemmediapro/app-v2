#!/bin/bash

# Script pour afficher les informations du tunnel localtunnel

cd "$(dirname "$0")"

echo "🔍 Recherche des informations du tunnel localtunnel..."
echo ""

# Vérifier si localtunnel est actif
if ! pgrep -f "localtunnel" > /dev/null; then
    echo "❌ Aucun tunnel localtunnel actif"
    echo ""
    echo "💡 Pour créer un tunnel, exécutez:"
    echo "   npx localtunnel --port 5173"
    echo ""
    exit 1
fi

echo "✅ Tunnel localtunnel actif détecté"
echo ""
echo "📋 Pour voir l'URL et le mot de passe:"
echo "   1. Regardez le terminal où vous avez lancé localtunnel"
echo "   2. Ou relancez localtunnel dans un terminal visible:"
echo ""
echo "   cd dashboard"
echo "   npx localtunnel --port 5173"
echo ""
echo "💡 Le mot de passe apparaît généralement comme:"
echo "   'Tunnel Password: xxxxx'"
echo "   juste après 'your url is: https://xxxxx.loca.lt'"
echo ""






