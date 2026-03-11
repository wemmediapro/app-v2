#!/bin/bash

# Script pour redémarrer tous les services et créer les tunnels

cd "$(dirname "$0")"

echo "🚀 Redémarrage complet avec tunnels"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Arrêter tous les processus existants
echo "🛑 Arrêt des processus existants..."
pkill -f "vite" 2>/dev/null
pkill -f "node.*server.js" 2>/dev/null
pkill -f "nodemon" 2>/dev/null
pkill -f "cloudflared" 2>/dev/null
pkill -f "localtunnel" 2>/dev/null
sleep 3
echo "✅ Processus arrêtés"
echo ""

# Démarrer le Backend
echo "🔧 Démarrage du Backend (port 3000)..."
cd backend
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
cd ..
sleep 5

if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend démarré${NC}"
else
    echo -e "${YELLOW}⚠️  Backend en cours de démarrage...${NC}"
fi
echo ""

# Démarrer le Frontend
echo "📱 Démarrage du Frontend (port 5173)..."
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 5

if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend démarré${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend en cours de démarrage...${NC}"
fi
echo ""

# Démarrer le Dashboard
echo "📊 Démarrage du Dashboard (port 5174)..."
cd dashboard
npm run dev > /tmp/dashboard.log 2>&1 &
DASHBOARD_PID=$!
cd ..
sleep 5

if curl -s http://localhost:5174 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Dashboard démarré${NC}"
else
    echo -e "${YELLOW}⚠️  Dashboard en cours de démarrage...${NC}"
fi
echo ""

# Attendre un peu pour que tout soit bien démarré
echo "⏳ Attente du démarrage complet des services..."
sleep 5

# Vérifier que tous les services sont actifs
echo ""
echo "🔍 Vérification finale des services..."
FRONTEND_OK=false
DASHBOARD_OK=false
BACKEND_OK=false

if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend actif sur http://localhost:5173${NC}"
    FRONTEND_OK=true
else
    echo -e "${YELLOW}⚠️  Frontend non accessible${NC}"
fi

if curl -s http://localhost:5174 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Dashboard actif sur http://localhost:5174${NC}"
    DASHBOARD_OK=true
else
    echo -e "${YELLOW}⚠️  Dashboard non accessible${NC}"
fi

if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend actif sur http://localhost:3000${NC}"
    BACKEND_OK=true
else
    echo -e "${YELLOW}⚠️  Backend non accessible${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🌐 Création des tunnels Cloudflare (SANS MOT DE PASSE)..."
echo "═══════════════════════════════════════════════════════════"
echo ""

# Fonction pour créer un tunnel cloudflared et capturer l'URL
create_tunnel() {
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

# Créer les tunnels
if [ "$FRONTEND_OK" = true ]; then
    create_tunnel 5173 "FRONTEND" "$BLUE" &
    sleep 3
fi

if [ "$DASHBOARD_OK" = true ]; then
    create_tunnel 5174 "DASHBOARD" "$GREEN" &
    sleep 3
fi

echo ""
echo "⏳ Attente de la création des tunnels..."
sleep 10

# Afficher le résumé
echo ""
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📊 RÉSUMÉ COMPLET"
echo "═══════════════════════════════════════════════════════════"
echo ""

if [ "$BACKEND_OK" = true ]; then
    echo -e "${GREEN}🔧 Backend:${NC}   http://localhost:3000"
fi

if [ "$FRONTEND_OK" = true ]; then
    echo -e "${BLUE}📱 Frontend:${NC}  http://localhost:5173"
    if [ -f "/tmp/gnv-cloudflared-FRONTEND.txt" ]; then
        FRONTEND_URL=$(cat /tmp/gnv-cloudflared-FRONTEND.txt)
        echo -e "   ${GREEN}🌐 Tunnel: ${FRONTEND_URL}${NC}"
    else
        echo -e "   ${YELLOW}   Tunnel en cours de création...${NC}"
    fi
fi

if [ "$DASHBOARD_OK" = true ]; then
    echo -e "${GREEN}📊 Dashboard:${NC} http://localhost:5174"
    if [ -f "/tmp/gnv-cloudflared-DASHBOARD.txt" ]; then
        DASHBOARD_URL=$(cat /tmp/gnv-cloudflared-DASHBOARD.txt)
        echo -e "   ${GREEN}🌐 Tunnel: ${DASHBOARD_URL}${NC}"
    else
        echo -e "   ${YELLOW}   Tunnel en cours de création...${NC}"
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "💡 Les tunnels sont en cours de création..."
echo "📋 Les URLs complètes seront affichées ci-dessus"
echo "🛑 Pour arrêter tout: pkill -f 'vite|cloudflared|node.*server'"
echo ""
echo "⏳ Les tunnels restent actifs. Appuyez sur Ctrl+C pour arrêter."
echo ""

# Attendre indéfiniment
wait
