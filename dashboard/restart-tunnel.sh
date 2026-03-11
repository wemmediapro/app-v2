#!/bin/bash

# Script pour redémarrer le tunnel en cas d'erreur

cd "$(dirname "$0")"

echo "🔄 Redémarrage du tunnel..."
echo ""

# Arrêter les anciens tunnels
pkill -f "cloudflared" 2>/dev/null
sleep 2

# Vérifier que le proxy est actif
if ! curl -s http://localhost:5174 > /dev/null 2>&1; then
    echo "📦 Redémarrage du proxy..."
    pkill -f "proxy-server" 2>/dev/null
    sleep 1
    node proxy-server.js > /tmp/proxy.log 2>&1 &
    sleep 3
fi

# Vérifier que Vite est actif
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "📦 Redémarrage de Vite..."
    pkill -f "vite" 2>/dev/null
    sleep 1
    npm run dev > /tmp/vite.log 2>&1 &
    sleep 5
fi

echo "✅ Services vérifiés"
echo ""
echo "🌐 Création d'un nouveau tunnel..."
echo ""

# Créer un nouveau tunnel
npx --yes cloudflared tunnel --url http://localhost:5174 2>&1 | while IFS= read -r line; do
    echo "$line"
    
    # Détecter l'URL
    if [[ $line == *"https://"* ]] && [[ $line == *"trycloudflare.com"* ]]; then
        URL=$(echo "$line" | grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | head -1)
        if [ -n "$URL" ]; then
            echo ""
            echo "═══════════════════════════════════════════════════════════"
            echo "🎉 NOUVEAU TUNNEL CRÉÉ!"
            echo "═══════════════════════════════════════════════════════════"
            echo ""
            echo "📱 URL PUBLIQUE: $URL"
            echo ""
            echo "✅ Aucun mot de passe requis"
            echo "🛑 Appuyez sur Ctrl+C pour arrêter"
            echo "═══════════════════════════════════════════════════════════"
            echo ""
        fi
    fi
done






