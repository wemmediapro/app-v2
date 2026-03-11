#!/bin/bash

# Script pour créer des tunnels publics vers l'application GNV OnBoard
# Expose le Frontend (5173) et le Dashboard (5174)

echo "🚀 Création de tunnels pour GNV OnBoard"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Couleurs pour les messages
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Arrêter les anciens tunnels
echo "🛑 Arrêt des anciens tunnels..."
pkill -f "localtunnel" 2>/dev/null
sleep 2

# Vérifier que les services sont actifs
echo "🔍 Vérification des services..."
FRONTEND_ACTIVE=false
DASHBOARD_ACTIVE=false

if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend actif sur http://localhost:5173${NC}"
    FRONTEND_ACTIVE=true
else
    echo -e "${YELLOW}⚠️  Frontend non actif sur le port 5173${NC}"
fi

if curl -s http://localhost:5174 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Dashboard actif sur http://localhost:5174${NC}"
    DASHBOARD_ACTIVE=true
else
    echo -e "${YELLOW}⚠️  Dashboard non actif sur le port 5174${NC}"
fi

if [ "$FRONTEND_ACTIVE" = false ] && [ "$DASHBOARD_ACTIVE" = false ]; then
    echo ""
    echo -e "${YELLOW}❌ Aucun service actif. Démarrez d'abord les services:${NC}"
    echo "   Frontend:  cd . && npm run dev"
    echo "   Dashboard: cd dashboard && npm run dev"
    exit 1
fi

echo ""
echo "🌐 Création des tunnels localtunnel..."
echo ""

# Fonction pour créer un tunnel et capturer l'URL
create_tunnel() {
    local PORT=$1
    local NAME=$2
    local COLOR=$3
    
    echo -e "${COLOR}📱 Création tunnel pour ${NAME} (port ${PORT})...${NC}"
    
    npx --yes localtunnel --port $PORT 2>&1 | while IFS= read -r line; do
        echo "[${NAME}] $line"
        
        # Extraire l'URL
        if [[ $line == *"your url is"* ]] || [[ $line == *"url is"* ]] || [[ $line == *"https://"* ]]; then
            URL=$(echo "$line" | grep -oE 'https://[a-zA-Z0-9-]+\.loca\.lt' | head -1)
            if [ -n "$URL" ]; then
                echo ""
                echo -e "${COLOR}═══════════════════════════════════════════════════════════${NC}"
                echo -e "${COLOR}🎉 TUNNEL ${NAME} CRÉÉ AVEC SUCCÈS!${NC}"
                echo -e "${COLOR}═══════════════════════════════════════════════════════════${NC}"
                echo -e "${GREEN}📱 URL PUBLIQUE: ${URL}${NC}"
                echo -e "${BLUE}🏠 URL LOCALE:   http://localhost:${PORT}${NC}"
                echo -e "${COLOR}═══════════════════════════════════════════════════════════${NC}"
                echo ""
                
                # Sauvegarder l'URL dans un fichier
                echo "$URL" > "/tmp/gnv-tunnel-${NAME}.txt"
            fi
        fi
        
        # Extraire le mot de passe si présent
        if [[ $line == *"password"* ]] || [[ $line == *"Password"* ]]; then
            PASSWORD=$(echo "$line" | grep -oP 'password[:\s]+[^\s]+' | cut -d: -f2 | tr -d ' ' || echo "$line" | grep -oP '[A-Za-z0-9]{6,}' | tail -1)
            if [ -n "$PASSWORD" ] && [ ${#PASSWORD} -gt 5 ]; then
                echo -e "${YELLOW}🔑 MOT DE PASSE: ${PASSWORD}${NC}"
                echo "$PASSWORD" > "/tmp/gnv-tunnel-${NAME}-password.txt"
            fi
        fi
    done
}

# Créer les tunnels en arrière-plan
if [ "$FRONTEND_ACTIVE" = true ]; then
    create_tunnel 5173 "FRONTEND" "$BLUE" &
    FRONTEND_PID=$!
    sleep 3
fi

if [ "$DASHBOARD_ACTIVE" = true ]; then
    create_tunnel 5174 "DASHBOARD" "$GREEN" &
    DASHBOARD_PID=$!
    sleep 3
fi

echo ""
echo -e "${GREEN}✅ Tunnels en cours de création...${NC}"
echo ""
echo "💡 Les URLs publiques seront affichées ci-dessus"
echo "🛑 Pour arrêter les tunnels: pkill -f localtunnel"
echo "📋 Les URLs sont également sauvegardées dans /tmp/gnv-tunnel-*.txt"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Attendre que les tunnels se connectent
sleep 5

# Afficher un résumé
echo ""
echo "📊 RÉSUMÉ DES TUNNELS:"
echo "═══════════════════════════════════════════════════════════"

if [ -f "/tmp/gnv-tunnel-FRONTEND.txt" ]; then
    FRONTEND_URL=$(cat /tmp/gnv-tunnel-FRONTEND.txt)
    echo -e "${BLUE}📱 Frontend:  ${FRONTEND_URL}${NC}"
    if [ -f "/tmp/gnv-tunnel-FRONTEND-password.txt" ]; then
        FRONTEND_PASS=$(cat /tmp/gnv-tunnel-FRONTEND-password.txt)
        echo -e "${YELLOW}   Mot de passe: ${FRONTEND_PASS}${NC}"
    fi
fi

if [ -f "/tmp/gnv-tunnel-DASHBOARD.txt" ]; then
    DASHBOARD_URL=$(cat /tmp/gnv-tunnel-DASHBOARD.txt)
    echo -e "${GREEN}📊 Dashboard: ${DASHBOARD_URL}${NC}"
    if [ -f "/tmp/gnv-tunnel-DASHBOARD-password.txt" ]; then
        DASHBOARD_PASS=$(cat /tmp/gnv-tunnel-DASHBOARD-password.txt)
        echo -e "${YELLOW}   Mot de passe: ${DASHBOARD_PASS}${NC}"
    fi
fi

echo "═══════════════════════════════════════════════════════════"
echo ""
echo "⏳ Les tunnels restent actifs. Appuyez sur Ctrl+C pour arrêter."
echo ""

# Attendre indéfiniment (ou jusqu'à Ctrl+C)
wait
