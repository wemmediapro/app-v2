#!/bin/bash

# Script pour démarrer Vite + Proxy + Tunnel

cd "$(dirname "$0")"

echo "🚀 Démarrage du serveur avec proxy (SANS vérification du host)"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Arrêter les processus existants
pkill -f "vite" 2>/dev/null
pkill -f "proxy-server" 2>/dev/null
pkill -f "cloudflared" 2>/dev/null
sleep 2

# Démarrer Vite sur le port 5173
echo "📦 Démarrage de Vite sur le port 5173..."
npm run dev > /tmp/vite.log 2>&1 &
VITE_PID=$!
sleep 5

# Démarrer le serveur proxy sur le port 5174
echo "🔄 Démarrage du serveur proxy sur le port 5174..."
node proxy-server.js > /tmp/proxy.log 2>&1 &
PROXY_PID=$!
sleep 3

# Vérifier que tout fonctionne
if curl -s http://localhost:5174 > /dev/null 2>&1; then
    echo "✅ Serveur proxy actif sur http://localhost:5174"
    echo ""
    echo "🌐 Création du tunnel public (SANS mot de passe)..."
    echo ""
    
    # Créer le tunnel vers le port 5174 (proxy)
    npx --yes cloudflared tunnel --url http://localhost:5174 2>&1 | while IFS= read -r line; do
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
                echo "🏠 URL LOCALE:   http://localhost:5174"
                echo ""
                echo "✅ Aucun mot de passe requis!"
                echo "✅ Aucune vérification du host!"
                echo "💡 Partagez cette URL directement pour la démonstration"
                echo ""
                echo "🛑 Appuyez sur Ctrl+C pour arrêter"
                echo "═══════════════════════════════════════════════════════════"
                echo ""
            fi
        fi
    done
else
    echo "❌ Erreur: Le serveur proxy n'a pas démarré correctement"
    echo "💡 Vérifiez les logs: cat /tmp/proxy.log"
    exit 1
fi






