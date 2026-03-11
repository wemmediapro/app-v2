#!/bin/bash

# Script pour obtenir l'URL et le mot de passe du tunnel

cd "$(dirname "$0")"

echo "🚀 Création d'un nouveau tunnel pour afficher le mot de passe"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Arrêter les anciens tunnels
pkill -f "localtunnel" 2>/dev/null
sleep 2

echo "⏳ Création du tunnel (cela peut prendre 10-15 secondes)..."
echo ""

# Créer le tunnel et capturer l'URL et le mot de passe
npx --yes localtunnel --port 5173 2>&1 | while IFS= read -r line; do
    echo "$line"
    
    # Détecter l'URL
    if [[ $line == *"your url is"* ]] || [[ $line == *"https://"* ]]; then
        URL=$(echo "$line" | grep -oE 'https://[a-zA-Z0-9-]+\.loca\.lt' | head -1)
        if [ -n "$URL" ]; then
            echo ""
            echo "═══════════════════════════════════════════════════════════"
            echo "📱 URL DU TUNNEL: $URL"
            echo "═══════════════════════════════════════════════════════════"
            echo ""
        fi
    fi
    
    # Détecter le mot de passe
    if [[ $line == *"password"* ]] || [[ $line == *"Password"* ]] || [[ $line == *"Tunnel Password"* ]]; then
        PASSWORD=$(echo "$line" | grep -oE '[A-Za-z0-9]{6,}' | tail -1)
        if [ -n "$PASSWORD" ] && [ ${#PASSWORD} -ge 6 ]; then
            echo ""
            echo "═══════════════════════════════════════════════════════════"
            echo "🔑 MOT DE PASSE: $PASSWORD"
            echo "═══════════════════════════════════════════════════════════"
            echo ""
        fi
    fi
done






