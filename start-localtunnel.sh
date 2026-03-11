#!/bin/bash

# Script pour créer des tunnels localtunnel (plus fiable que cloudflared)

cd "$(dirname "$0")"

echo "🚀 Création de tunnels localtunnel pour accès distant"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Arrêter les anciens tunnels
pkill -f "localtunnel" 2>/dev/null
pkill -f "cloudflared" 2>/dev/null
sleep 2

# Vérifier que les services sont actifs
echo "🔍 Vérification des services..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ Front-end actif sur http://localhost:5173"
else
    echo "❌ Front-end non actif - Démarrez d'abord: cd dashboard && npm run dev"
    exit 1
fi

if curl -s http://localhost:3001 > /dev/null 2>&1; then
    echo "✅ Backend actif sur http://localhost:3001"
else
    echo "⚠️  Backend non actif sur le port 3001"
fi

echo ""
echo "🌐 Création des tunnels localtunnel..."
echo ""

# Tunnel Front-end
echo "📱 Tunnel Front-end (Dashboard) - Port 5173..."
cd dashboard
npx --yes localtunnel --port 5173 2>&1 | while IFS= read -r line; do
    echo "[FRONT-END] $line"
    if [[ $line == *"your url is"* ]] || [[ $line == *"https://"* ]]; then
        URL=$(echo "$line" | grep -oE 'https://[a-zA-Z0-9-]+\.loca\.lt' | head -1)
        if [ -n "$URL" ]; then
            echo ""
            echo "═══════════════════════════════════════════════════════════"
            echo "📱 FRONT-END: $URL"
            echo "═══════════════════════════════════════════════════════════"
            echo ""
        fi
    fi
done &
FRONTEND_PID=$!

# Attendre un peu
sleep 3

# Tunnel Backend (si actif)
if curl -s http://localhost:3001 > /dev/null 2>&1; then
    echo "🔧 Tunnel Backend (API) - Port 3001..."
    cd ..
    npx --yes localtunnel --port 3001 2>&1 | while IFS= read -r line; do
        echo "[BACKEND] $line"
        if [[ $line == *"your url is"* ]] || [[ $line == *"https://"* ]]; then
            URL=$(echo "$line" | grep -oE 'https://[a-zA-Z0-9-]+\.loca\.lt' | head -1)
            if [ -n "$URL" ]; then
                echo ""
                echo "═══════════════════════════════════════════════════════════"
                echo "🔧 BACKEND: $URL"
                echo "═══════════════════════════════════════════════════════════"
                echo ""
            fi
        fi
    done &
    BACKEND_PID=$!
fi

echo ""
echo "✅ Tunnels localtunnel démarrés"
echo "🛑 Pour arrêter: pkill -f localtunnel"
echo ""
echo "💡 Les URLs seront affichées ci-dessus"
echo "   Note: localtunnel peut afficher une page de mot de passe"
echo "   Le mot de passe sera dans les messages ci-dessus"
echo ""

# Attendre
wait






