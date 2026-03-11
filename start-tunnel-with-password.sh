#!/bin/bash

# Script simple pour démarrer le tunnel avec mot de passe
# Utilise ngrok avec authentification HTTP de base

PORT=5173
USERNAME=${NGROK_USERNAME:-admin}
PASSWORD=${NGROK_PASSWORD:-1234}

echo "🚀 Démarrage du tunnel ngrok avec authentification..."
echo "👤 Utilisateur: $USERNAME"
echo "🔐 Mot de passe: $PASSWORD"
echo ""

# Vérifier si le serveur Vite est en cours d'exécution
if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "🌐 Démarrage du serveur Vite..."
    npm run dev > /dev/null 2>&1 &
    sleep 5
fi

# Vérifier si ngrok est disponible
if command -v ngrok &> /dev/null; then
    echo "🔗 Création du tunnel sécurisé avec ngrok..."
    ngrok http --basic-auth="$USERNAME:$PASSWORD" $PORT
elif command -v npx &> /dev/null; then
    echo "🔗 Création du tunnel sécurisé avec ngrok (via npx)..."
    npx ngrok http --basic-auth="$USERNAME:$PASSWORD" $PORT
else
    echo "❌ ngrok n'est pas disponible"
    echo "💡 Alternative: utilisez localtunnel (sans mot de passe)"
    echo "   npx localtunnel --port $PORT"
    exit 1
fi
