#!/bin/bash
# Tunnel public pour exposer l'app (Cloudflare - gratuit, sans mot de passe)

cd "$(dirname "$0")"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 Tunnel public - accès depuis internet"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Ports à exposer (frontend app passagers = 5173, backend API = 3000)
FRONTEND_PORT=${1:-5173}
BACKEND_PORT=${2:-3000}

# Arrêter les anciens tunnels
pkill -f "cloudflared" 2>/dev/null
sleep 1

# Vérifier les services
echo "🔍 Vérification des services..."
FRONT_OK=false
BACK_OK=false
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${FRONTEND_PORT}" 2>/dev/null | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✅ Frontend actif sur http://localhost:${FRONTEND_PORT}${NC}"
    FRONT_OK=true
else
    echo -e "${YELLOW}⚠️  Rien sur le port ${FRONTEND_PORT}. Démarrez d'abord: npm run dev${NC}"
fi
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${BACKEND_PORT}" 2>/dev/null | grep -q "200\|301\|302\|404"; then
    echo -e "${GREEN}✅ Backend actif sur http://localhost:${BACKEND_PORT}${NC}"
    BACK_OK=true
else
    echo -e "${YELLOW}⚠️  Backend non actif sur le port ${BACKEND_PORT}${NC}"
fi
echo ""

if [ "$FRONT_OK" = false ] && [ "$BACK_OK" = false ]; then
    echo "❌ Aucun service actif. Démarrez au moins:"
    echo "   Frontend:  npm run dev"
    echo "   Backend:   cd backend && npm run dev"
    exit 1
fi

# Dossier Bureau pour sauvegarder les URLs
DESKTOP="${HOME}/Desktop"
mkdir -p "$DESKTOP"
URLS_FILE="${DESKTOP}/gnv-tunnel-urls.txt"
echo "Tunnel GNV OnBoard - $(date)" > "$URLS_FILE"
echo "================================" >> "$URLS_FILE"
echo "" >> "$URLS_FILE"

# Créer tunnel Frontend (principal)
if [ "$FRONT_OK" = true ]; then
    echo -e "${BLUE}🌐 Création du tunnel public (port ${FRONTEND_PORT})...${NC}"
    echo ""
    npx --yes cloudflared tunnel --url "http://localhost:${FRONTEND_PORT}" 2>&1 | while IFS= read -r line; do
        echo "$line"
        if [[ "$line" == *"https://"* ]] && [[ "$line" == *"trycloudflare.com"* ]]; then
            URL=$(echo "$line" | grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | head -1)
            if [ -n "$URL" ]; then
                echo "" | tee -a "$URLS_FILE"
                echo "═══════════════════════════════════════════════════════════" | tee -a "$URLS_FILE"
                echo "🎉 URL PUBLIQUE (Frontend): $URL" | tee -a "$URLS_FILE"
                echo "   Local: http://localhost:${FRONTEND_PORT}" | tee -a "$URLS_FILE"
                echo "═══════════════════════════════════════════════════════════" | tee -a "$URLS_FILE"
                echo "$URL" > "${DESKTOP}/gnv-tunnel-frontend-url.txt"
            fi
        fi
    done &
    TUNNEL_PID=$!
    sleep 8
    if [ -f "${DESKTOP}/gnv-tunnel-frontend-url.txt" ]; then
        PUBLIC_URL=$(cat "${DESKTOP}/gnv-tunnel-frontend-url.txt")
        echo ""
        echo -e "${GREEN}✅ Tunnel actif !${NC}"
        echo -e "${GREEN}   URL publique : ${PUBLIC_URL}${NC}"
        echo -e "${GREEN}   URLs enregistrées sur le Bureau : gnv-tunnel-urls.txt / gnv-tunnel-frontend-url.txt${NC}"
    fi
    wait $TUNNEL_PID 2>/dev/null
else
    # Au moins le backend
    echo -e "${BLUE}🌐 Création du tunnel (Backend port ${BACKEND_PORT})...${NC}"
    npx --yes cloudflared tunnel --url "http://localhost:${BACKEND_PORT}" 2>&1 | while IFS= read -r line; do
        echo "$line"
        if [[ "$line" == *"https://"* ]] && [[ "$line" == *"trycloudflare.com"* ]]; then
            URL=$(echo "$line" | grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | head -1)
            if [ -n "$URL" ]; then
                echo "🎉 URL PUBLIQUE (Backend): $URL" >> "$URLS_FILE"
                echo "$URL" > "${DESKTOP}/gnv-tunnel-backend-url.txt"
            fi
        fi
    done
fi
