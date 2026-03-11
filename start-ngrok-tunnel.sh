#!/bin/bash

# Script pour démarrer le tunnel ngrok avec authentification

export NGROK_AUTH_TOKEN='35Nq9utRoqcximJfj3ZKwUmLxEa_82pJABufoWAenkbPWxDzH'

PORT=5173
USERNAME="admin"
PASSWORD="12345678"

echo "🚀 Démarrage du tunnel ngrok sécurisé..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 URL locale:    http://localhost:$PORT"
echo "👤 Utilisateur:   $USERNAME"
echo "🔐 Mot de passe:  $PASSWORD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Vérifier si le serveur Vite est en cours d'exécution
if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Le serveur Vite n'est pas actif sur le port $PORT"
    echo "💡 Démarrez-le avec: npm run dev"
    echo ""
fi

# Démarrer ngrok
echo "🔗 Création du tunnel..."
npx ngrok http --basic-auth="$USERNAME:$PASSWORD" $PORT
