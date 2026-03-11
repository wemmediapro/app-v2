#!/bin/bash

# Script pour créer des tunnels SSH via serveo.net (plus fiable)

echo "🚀 Création de tunnels SSH pour accès distant"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Vérifier que SSH est disponible
if ! which ssh > /dev/null; then
    echo "❌ SSH n'est pas disponible"
    exit 1
fi

# Arrêter les anciens tunnels
pkill -f "ssh.*serveo" 2>/dev/null
sleep 2

echo "🌐 Création des tunnels SSH via serveo.net..."
echo ""

# Tunnel Front-end (port 5173)
echo "📱 Tunnel Front-end (Dashboard) - Port 5173..."
ssh -R 80:localhost:5173 serveo.net 2>&1 | while IFS= read -r line; do
    echo "[FRONT-END] $line"
    if [[ $line == *"Forwarding"* ]] || [[ $line == *"https://"* ]] || [[ $line == *"http://"* ]]; then
        URL=$(echo "$line" | grep -oE 'https?://[a-zA-Z0-9.-]+\.serveo\.net' | head -1)
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

# Attendre un peu avant de créer le second tunnel
sleep 3

# Tunnel Backend (port 3001)
echo "🔧 Tunnel Backend (API) - Port 3001..."
ssh -R 80:localhost:3001 serveo.net 2>&1 | while IFS= read -r line; do
    echo "[BACKEND] $line"
    if [[ $line == *"Forwarding"* ]] || [[ $line == *"https://"* ]] || [[ $line == *"http://"* ]]; then
        URL=$(echo "$line" | grep -oE 'https?://[a-zA-Z0-9.-]+\.serveo\.net' | head -1)
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

echo ""
echo "✅ Tunnels SSH démarrés en arrière-plan"
echo "🛑 Pour arrêter: pkill -f 'ssh.*serveo'"
echo ""
echo "💡 Les URLs seront affichées ci-dessus"
echo ""

# Attendre
wait






