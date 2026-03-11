#!/bin/bash

# Script pour démarrer le tunnel et afficher clairement le mot de passe

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
echo "⏳ Attente du démarrage du serveur (5 secondes)..."
sleep 5

# Vérifier que le serveur est démarré
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "❌ Erreur: Le serveur n'a pas démarré correctement"
    kill $VITE_PID 2>/dev/null
    exit 1
fi

echo "✅ Serveur démarré sur http://localhost:5173"
echo ""
echo "🌐 Création du tunnel public..."
echo "═══════════════════════════════════════════════════════════"

# Créer un fichier temporaire pour capturer la sortie
TEMP_OUTPUT=$(mktemp)

# Lancer localtunnel et capturer la sortie
npx localtunnel --port 5173 --subdomain gnv-dashboard 2>&1 | tee "$TEMP_OUTPUT" &
TUNNEL_PID=$!

# Attendre que le tunnel se connecte
sleep 8

# Extraire l'URL et le mot de passe
TUNNEL_URL=$(grep -i "your url is\|url is" "$TEMP_OUTPUT" 2>/dev/null | grep -oP 'https://[^\s]+' | head -1)
TUNNEL_PASSWORD=$(grep -i "password" "$TEMP_OUTPUT" 2>/dev/null | grep -oP '[A-Za-z0-9]{6,}' | tail -1)

# Si on n'a pas trouvé le mot de passe, chercher dans toutes les lignes
if [ -z "$TUNNEL_PASSWORD" ]; then
    TUNNEL_PASSWORD=$(grep -v "node_modules\|npm\|localtunnel" "$TEMP_OUTPUT" 2>/dev/null | grep -oP '[A-Za-z0-9]{8,}' | head -1)
fi

# Afficher les informations
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🎉 TUNNEL DE DÉMONSTRATION CRÉÉ AVEC SUCCÈS!"
echo "═══════════════════════════════════════════════════════════"
echo ""
if [ -n "$TUNNEL_URL" ]; then
    echo "📱 URL PUBLIQUE: $TUNNEL_URL"
else
    echo "📱 URL PUBLIQUE: https://gnv-dashboard.loca.lt"
fi
echo "🏠 URL LOCALE:   http://localhost:5173"
echo ""

if [ -n "$TUNNEL_PASSWORD" ]; then
    echo "🔑 MOT DE PASSE: $TUNNEL_PASSWORD"
    echo ""
    echo "💡 Partagez l'URL et le mot de passe pour la démonstration"
else
    echo "⚠️  Le mot de passe sera affiché dans les logs ci-dessous"
    echo "💡 Regardez les messages ci-dessus pour trouver 'password'"
fi

echo ""
echo "📋 Logs du tunnel (recherchez 'password' ci-dessous):"
echo "═══════════════════════════════════════════════════════════"
tail -20 "$TEMP_OUTPUT" 2>/dev/null || echo "Logs en cours de génération..."
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🛑 Appuyez sur Ctrl+C pour arrêter le tunnel et le serveur"
echo ""

# Fonction de nettoyage
cleanup() {
    echo ""
    echo "🛑 Arrêt du tunnel et du serveur..."
    kill $VITE_PID 2>/dev/null
    kill $TUNNEL_PID 2>/dev/null
    pkill -f "localtunnel" 2>/dev/null
    pkill -f "vite" 2>/dev/null
    rm -f "$TEMP_OUTPUT"
    echo "✅ Arrêté"
    exit 0
}

# Capturer Ctrl+C
trap cleanup SIGINT SIGTERM

# Continuer à afficher les logs en temps réel
tail -f "$TEMP_OUTPUT" 2>/dev/null || wait






