#!/bin/bash

# Script pour démarrer le frontend avec un tunnel ngrok

echo "🚀 Démarrage du frontend avec tunnel ngrok..."

# Vérifier si ngrok est installé
if ! command -v ngrok &> /dev/null; then
    echo "📦 Installation de ngrok..."
    npm install -g ngrok@latest
fi

# Vérifier si le frontend est déjà en cours d'exécution
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Le port 5173 est déjà utilisé. Arrêt du processus existant..."
    kill $(lsof -ti:5173) 2>/dev/null
    sleep 2
fi

# Démarrer le frontend en arrière-plan
echo "🌐 Démarrage du serveur Vite..."
npm run dev > /dev/null 2>&1 &
VITE_PID=$!

# Attendre que le serveur démarre
echo "⏳ Attente du démarrage du serveur..."
sleep 5

# Vérifier que le serveur est bien démarré
if ! lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ Erreur: Le serveur n'a pas démarré correctement"
    exit 1
fi

# Démarrer ngrok
echo "🔗 Démarrage du tunnel ngrok..."
ngrok http 5173 --log=stdout > ngrok.log 2>&1 &
NGROK_PID=$!

sleep 3

# Récupérer l'URL du tunnel
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*' | grep -o 'https://[^"]*' | head -1)

if [ -z "$NGROK_URL" ]; then
    echo "❌ Erreur: Impossible de récupérer l'URL ngrok"
    echo "📋 Vérifiez les logs: cat ngrok.log"
    kill $VITE_PID $NGROK_PID 2>/dev/null
    exit 1
fi

echo ""
echo "✅ Frontend démarré avec succès!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 URL locale:    http://localhost:5173"
echo "🔗 URL publique:  $NGROK_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Pour arrêter: kill $VITE_PID $NGROK_PID"
echo "📋 Interface ngrok: http://localhost:4040"
echo ""

# Garder le script actif
wait
