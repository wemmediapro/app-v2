#!/bin/bash

# Script pour démarrer le tunnel avec affichage du mot de passe

echo "🚀 Démarrage du tunnel de démonstration GNV Dashboard"
echo ""

# Arrêter les processus existants
pkill -f "vite" 2>/dev/null
pkill -f "localtunnel" 2>/dev/null
sleep 2

# Démarrer Vite
echo "📦 Démarrage du serveur Vite..."
cd "$(dirname "$0")"
npm run dev:tunnel > /tmp/vite.log 2>&1 &
VITE_PID=$!

# Attendre le démarrage
sleep 5

# Démarrer le tunnel et capturer la sortie
echo "🌐 Création du tunnel public..."
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📱 TUNNEL EN COURS DE CRÉATION..."
echo "═══════════════════════════════════════════════════════════"
echo ""

# Lancer localtunnel et capturer toutes les sorties
npx localtunnel --port 5173 --subdomain gnv-dashboard 2>&1 | while IFS= read -r line; do
    echo "$line"
    
    # Extraire l'URL
    if [[ $line == *"your url is"* ]] || [[ $line == *"url is"* ]]; then
        URL=$(echo "$line" | grep -oP 'https://[^\s]+' | head -1)
        if [ -n "$URL" ]; then
            echo ""
            echo "═══════════════════════════════════════════════════════════"
            echo "🎉 TUNNEL CRÉÉ AVEC SUCCÈS!"
            echo "═══════════════════════════════════════════════════════════"
            echo "📱 URL PUBLIQUE: $URL"
            echo "🏠 URL LOCALE:   http://localhost:5173"
            echo "═══════════════════════════════════════════════════════════"
        fi
    fi
    
    # Extraire le mot de passe
    if [[ $line == *"password"* ]] || [[ $line == *"Password"* ]]; then
        PASSWORD=$(echo "$line" | grep -oP 'password[:\s]+[^\s]+' | cut -d: -f2 | tr -d ' ' || echo "$line" | grep -oP '[A-Za-z0-9]{6,}' | tail -1)
        if [ -n "$PASSWORD" ] && [ ${#PASSWORD} -gt 5 ]; then
            echo ""
            echo "🔑 MOT DE PASSE DU TUNNEL: $PASSWORD"
            echo "💡 Partagez cette URL et ce mot de passe pour la démonstration"
            echo ""
        fi
    fi
done







