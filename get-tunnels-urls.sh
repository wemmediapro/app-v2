#!/bin/bash

# Script pour obtenir les URLs des tunnels Cloudflare

echo "🌐 Récupération des URLs des tunnels Cloudflare..."
echo "═══════════════════════════════════════════════════════════"
echo ""

# Arrêter les anciens tunnels pour en créer de nouveaux avec capture d'URL
pkill -f cloudflared 2>/dev/null
sleep 2

# Vérifier que les services sont actifs
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "❌ Frontend non actif sur le port 5173"
    exit 1
fi

if ! curl -s http://localhost:5174 > /dev/null 2>&1; then
    echo "❌ Dashboard non actif sur le port 5174"
    exit 1
fi

echo "✅ Services actifs détectés"
echo ""

# Fonction pour créer un tunnel et capturer l'URL
create_and_capture_tunnel() {
    local PORT=$1
    local NAME=$2
    
    echo "📱 Création tunnel ${NAME} (port ${PORT})..."
    
    # Créer le tunnel en arrière-plan et capturer l'URL
    npx --yes cloudflared tunnel --url http://localhost:$PORT > /tmp/tunnel-${NAME}.log 2>&1 &
    TUNNEL_PID=$!
    
    # Attendre que l'URL soit générée
    for i in {1..15}; do
        sleep 1
        URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /tmp/tunnel-${NAME}.log 2>/dev/null | head -1)
        if [ -n "$URL" ]; then
            echo "$URL"
            echo "$URL" > /tmp/tunnel-${NAME}-url.txt
            return 0
        fi
    done
    
    echo "⏳ URL non encore disponible..."
    return 1
}

# Créer les tunnels
echo "🌐 Création des tunnels (cela peut prendre quelques secondes)..."
echo ""

FRONTEND_URL=$(create_and_capture_tunnel 5173 "frontend")
sleep 2
DASHBOARD_URL=$(create_and_capture_tunnel 5174 "dashboard")

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📊 URLS DES TUNNELS"
echo "═══════════════════════════════════════════════════════════"
echo ""

if [ -n "$FRONTEND_URL" ]; then
    echo "📱 FRONTEND:"
    echo "   🌐 URL Publique: $FRONTEND_URL"
    echo "   🏠 URL Locale:   http://localhost:5173"
    echo "   ✅ Aucun mot de passe requis"
else
    echo "📱 FRONTEND:"
    echo "   ⏳ URL en cours de génération..."
    echo "   💡 Vérifiez /tmp/tunnel-frontend.log pour l'URL"
fi

echo ""

if [ -n "$DASHBOARD_URL" ]; then
    echo "📊 DASHBOARD:"
    echo "   🌐 URL Publique: $DASHBOARD_URL"
    echo "   🏠 URL Locale:   http://localhost:5174"
    echo "   ✅ Aucun mot de passe requis"
else
    echo "📊 DASHBOARD:"
    echo "   ⏳ URL en cours de génération..."
    echo "   💡 Vérifiez /tmp/tunnel-dashboard.log pour l'URL"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "💡 Les tunnels restent actifs en arrière-plan"
echo "🛑 Pour arrêter: pkill -f cloudflared"
echo ""
