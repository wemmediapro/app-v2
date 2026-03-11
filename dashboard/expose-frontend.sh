#!/bin/bash

# Script pour exposer le frontend sur une URL publique
# Utilise localtunnel (déjà installé) ou ngrok

PORT=5173
SUBDOMAIN="gnv-dashboard"

echo "🌐 Exposition du frontend sur une URL publique..."
echo "📍 Port local: $PORT"
echo ""

# Vérifier si le serveur tourne sur le port 5173
if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Le serveur n'est pas démarré sur le port $PORT"
    echo "📦 Démarrage du serveur..."
    cd "$(dirname "$0")"
    npm run dev &
    sleep 5
fi

# Méthode 1: Utiliser localtunnel (déjà installé)
if command -v lt &> /dev/null; then
    echo "✅ Utilisation de localtunnel..."
    echo ""
    echo "🚀 Tunnel en cours de création..."
    echo "⏳ Veuillez patienter..."
    echo ""
    
    lt --port $PORT --subdomain $SUBDOMAIN 2>&1 | while IFS= read -r line; do
        echo "$line"
        if [[ $line == *"your url is:"* ]] || [[ $line == *"https://"* ]]; then
            URL=$(echo "$line" | grep -oP 'https://[^\s]+' | head -1)
            if [ ! -z "$URL" ]; then
                echo ""
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo "✅ Frontend accessible sur:"
                echo "   $URL"
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo ""
                echo "💡 Partagez ce lien pour accéder au dashboard"
                echo "🛑 Appuyez sur Ctrl+C pour arrêter le tunnel"
                echo ""
            fi
        fi
    done
else
    # Méthode 2: Utiliser npx localtunnel
    echo "✅ Utilisation de npx localtunnel..."
    echo ""
    echo "🚀 Tunnel en cours de création..."
    echo "⏳ Veuillez patienter..."
    echo ""
    
    npx -y localtunnel --port $PORT --subdomain $SUBDOMAIN 2>&1 | while IFS= read -r line; do
        echo "$line"
        if [[ $line == *"your url is:"* ]] || [[ $line == *"https://"* ]]; then
            URL=$(echo "$line" | grep -oP 'https://[^\s]+' | head -1)
            if [ ! -z "$URL" ]; then
                echo ""
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo "✅ Frontend accessible sur:"
                echo "   $URL"
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo ""
                echo "💡 Partagez ce lien pour accéder au dashboard"
                echo "🛑 Appuyez sur Ctrl+C pour arrêter le tunnel"
                echo ""
            fi
        fi
    done
fi


