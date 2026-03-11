#!/bin/bash

# Script final pour démarrer le tunnel avec serveur Express

cd "$(dirname "$0")"

echo "🚀 Démarrage du tunnel avec serveur Express"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Arrêter les processus existants
pkill -f "cloudflared" 2>/dev/null
pkill -f "simple-server" 2>/dev/null
pkill -f "proxy-server" 2>/dev/null
sleep 2

# Vérifier que Vite est actif
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "📦 Démarrage de Vite..."
    npm run dev > /tmp/vite.log 2>&1 &
    sleep 5
fi

# Démarrer le serveur Express
echo "📦 Démarrage du serveur Express..."
node simple-server.js > /tmp/simple-server.log 2>&1 &
sleep 3

# Vérifier que le serveur Express est actif
if curl -s http://localhost:5175 > /dev/null 2>&1; then
    echo "✅ Serveur Express actif sur http://localhost:5175"
    echo ""
    echo "🌐 Création du tunnel public (SANS mot de passe)..."
    echo ""
    
    # Créer le tunnel
    npx --yes cloudflared tunnel --url http://localhost:5175 2>&1 | while IFS= read -r line; do
        echo "$line"
        
        # Détecter l'URL
        if [[ $line == *"https://"* ]] && [[ $line == *"trycloudflare.com"* ]]; then
            URL=$(echo "$line" | grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | head -1)
            if [ -n "$URL" ]; then
                echo ""
                echo "═══════════════════════════════════════════════════════════"
                echo "🎉 TUNNEL CRÉÉ AVEC SUCCÈS!"
                echo "═══════════════════════════════════════════════════════════"
                echo ""
                echo "📱 URL PUBLIQUE: $URL"
                echo "🏠 URL LOCALE:   http://localhost:5175"
                echo ""
                echo "✅ Aucun mot de passe requis"
                echo "✅ Accepte tous les hosts (serveur Express)"
                echo "💡 Partagez cette URL directement pour la démonstration"
                echo ""
                echo "🛑 Appuyez sur Ctrl+C pour arrêter"
                echo "═══════════════════════════════════════════════════════════"
                echo ""
            fi
        fi
    done
else
    echo "❌ Erreur: Le serveur Express n'a pas démarré"
    echo "💡 Vérifiez les logs: cat /tmp/simple-server.log"
    exit 1
fi






