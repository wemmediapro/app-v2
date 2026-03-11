#!/bin/bash

# Script simple pour créer un tunnel de démo rapide

echo "🚀 Création d'un tunnel de démonstration..."
echo ""

# Vérifier que le serveur est actif
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "⚠️  Le serveur n'est pas actif sur le port 5173"
    echo "💡 Démarrez d'abord le serveur avec: npm run dev:tunnel"
    echo ""
    echo "📦 Démarrage du serveur maintenant..."
    cd "$(dirname "$0")"
    npm run dev:tunnel > /tmp/vite.log 2>&1 &
    VITE_PID=$!
    sleep 5
    echo "✅ Serveur démarré"
fi

echo "🌐 Création du tunnel (cela peut prendre quelques secondes)..."
echo ""

# Créer le tunnel et capturer l'URL
TUNNEL_OUTPUT=$(npx --yes localtunnel --port 5173 2>&1 &)
TUNNEL_PID=$!

# Attendre un peu pour que le tunnel se connecte
sleep 8

# Essayer de récupérer l'URL depuis les logs
echo "═══════════════════════════════════════════════════════════"
echo "📱 TUNNEL DE DÉMONSTRATION"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🏠 URL locale: http://localhost:5173"
echo ""
echo "🌐 Le tunnel est en cours de création..."
echo "💡 L'URL publique sera affichée dans le terminal où vous avez lancé:"
echo "   npx localtunnel --port 5173"
echo ""
echo "📋 Pour voir l'URL maintenant, exécutez dans un autre terminal:"
echo "   npx localtunnel --port 5173"
echo "═══════════════════════════════════════════════════════════"






