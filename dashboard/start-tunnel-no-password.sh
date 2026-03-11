#!/bin/bash

# Script pour créer un tunnel SANS mot de passe avec serveo.net

cd "$(dirname "$0")"

echo "🚀 Création d'un tunnel SANS mot de passe..."
echo ""

# Vérifier que le serveur est actif
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "⚠️  Le serveur n'est pas actif"
    echo "📦 Démarrage du serveur..."
    npm run dev:tunnel > /tmp/vite-dashboard.log 2>&1 &
    sleep 5
fi

echo "✅ Serveur actif sur http://localhost:5173"
echo ""
echo "🌐 Création du tunnel public (SANS mot de passe)..."
echo "⏳ Veuillez patienter..."
echo ""

# Créer le tunnel avec serveo.net (SSH)
ssh -R 80:localhost:5173 serveo.net 2>&1 | while IFS= read -r line; do
    echo "$line"
    
    # Détecter l'URL
    if [[ $line == *"Forwarding"* ]] || [[ $line == *"https://"* ]] || [[ $line == *"http://"* ]]; then
        URL=$(echo "$line" | grep -oE 'https?://[a-zA-Z0-9.-]+\.serveo\.net' | head -1)
        if [ -n "$URL" ]; then
            echo ""
            echo "═══════════════════════════════════════════════════════════"
            echo "🎉 TUNNEL CRÉÉ AVEC SUCCÈS (SANS MOT DE PASSE)!"
            echo "═══════════════════════════════════════════════════════════"
            echo ""
            echo "📱 URL PUBLIQUE: $URL"
            echo "🏠 URL LOCALE:   http://localhost:5173"
            echo ""
            echo "✅ Aucun mot de passe requis!"
            echo "💡 Partagez cette URL directement pour la démonstration"
            echo ""
            echo "🛑 Appuyez sur Ctrl+C pour arrêter"
            echo "═══════════════════════════════════════════════════════════"
            echo ""
        fi
    fi
done






