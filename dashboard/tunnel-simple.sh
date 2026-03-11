#!/bin/bash

# Tunnel simple SANS mot de passe avec cloudflared

cd "$(dirname "$0")"

echo "🚀 Tunnel SANS mot de passe - Dashboard GNV"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Vérifier que le serveur est actif
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "📦 Démarrage du serveur..."
    npm run dev:tunnel > /tmp/vite-dashboard.log 2>&1 &
    sleep 5
fi

echo "✅ Serveur: http://localhost:5173"
echo ""
echo "🌐 Création du tunnel public (SANS mot de passe)..."
echo ""

# Utiliser cloudflared via npx
npx --yes cloudflared tunnel --url http://localhost:5173






