#!/bin/bash

# Script pour créer des tunnels publics SANS MOT DE PASSE
# Utilise Cloudflared (Cloudflare Tunnel) - Gratuit et sans authentification

echo "🚀 Création de tunnels SANS MOT DE PASSE"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Arrêter les anciens tunnels
echo "🛑 Arrêt des anciens tunnels..."
pkill -f cloudflared 2>/dev/null
pkill -f localtunnel 2>/dev/null
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
echo "🌐 Création des tunnels Cloudflared (SANS MOT DE PASSE)..."
echo ""

# Fonction pour créer un tunnel cloudflared
create_cloudflared_tunnel() {
    local PORT=$1
    local NAME=$2
    local COLOR=$3
    
    echo -e "${COLOR}📱 Création tunnel ${NAME} (port ${PORT})...${NC}"
    
    npx --yes cloudflared tunnel --url http://localhost:$PORT 2>&1 | while IFS= read -r line; do
        echo "[${NAME}] $line"
        
        # Extraire l'URL
        if [[ $line == *"https://"* ]] && [[ $line == *"trycloudflare.com"* ]]; then
            URL=$(echo "$line" | grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | head -1)
            if [ -n "$URL" ]; then
                echo ""
                echo -e "${COLOR}═══════════════════════════════════════════════════════════${NC}"
                echo -e "${COLOR}🎉 TUNNEL ${NAME} CRÉÉ AVEC SUCCÈS!${NC}"
                echo -e "${COLOR}═══════════════════════════════════════════════════════════${NC}"
                echo -e "${GREEN}📱 URL PUBLIQUE: ${URL}${NC}"
                echo -e "${BLUE}🏠 URL LOCALE:   http://localhost:${PORT}${NC}"
                echo -e "${GREEN}✅ AUCUN MOT DE PASSE REQUIS!${NC}"
                echo -e "${COLOR}═══════════════════════════════════════════════════════════${NC}"
                echo ""
                
                # Sauvegarder l'URL
                echo "$URL" > "/tmp/gnv-cloudflared-${NAME}.txt"
            fi
        fi
    done
}

# Créer les tunnels en arrière-plan
if [ "$FRONTEND_ACTIVE" = true ]; then
    create_cloudflared_tunnel 5173 "FRONTEND" "$BLUE" &
    FRONTEND_PID=$!
    sleep 3
fi

if [ "$DASHBOARD_ACTIVE" = true ]; then
    create_cloudflared_tunnel 5174 "DASHBOARD" "$GREEN" &
    DASHBOARD_PID=$!
    sleep 3
fi

echo ""
echo -e "${GREEN}✅ Tunnels en cours de création...${NC}"
echo ""
echo "💡 Les URLs publiques seront affichées ci-dessus"
echo "🛑 Pour arrêter les tunnels: pkill -f cloudflared"
echo "📋 Les URLs sont également sauvegardées dans /tmp/gnv-cloudflared-*.txt"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Attendre que les tunnels se connectent
sleep 8

# Afficher un résumé
echo ""
echo "📊 RÉSUMÉ DES TUNNELS (SANS MOT DE PASSE):"
echo "═══════════════════════════════════════════════════════════"

if [ -f "/tmp/gnv-cloudflared-FRONTEND.txt" ]; then
    FRONTEND_URL=$(cat /tmp/gnv-cloudflared-FRONTEND.txt)
    echo -e "${BLUE}📱 Frontend:  ${FRONTEND_URL}${NC}"
    echo -e "${GREEN}   ✅ Aucun mot de passe requis${NC}"
fi

if [ -f "/tmp/gnv-cloudflared-DASHBOARD.txt" ]; then
    DASHBOARD_URL=$(cat /tmp/gnv-cloudflared-DASHBOARD.txt)
    echo -e "${GREEN}📊 Dashboard: ${DASHBOARD_URL}${NC}"
    echo -e "${GREEN}   ✅ Aucun mot de passe requis${NC}"
fi

echo "═══════════════════════════════════════════════════════════"
echo ""
echo "⏳ Les tunnels restent actifs. Appuyez sur Ctrl+C pour arrêter."
echo ""

# Attendre indéfiniment
wait
