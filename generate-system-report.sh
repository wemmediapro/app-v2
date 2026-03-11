#!/bin/bash

# Script pour générer un rapport de compatibilité système complet
# Usage: ./generate-system-report.sh [output-file]

set -e

OUTPUT_FILE=${1:-"system-compatibility-report-$(date +%Y%m%d_%H%M%S).txt"}

# Couleurs pour la console
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}📊 Génération du rapport de compatibilité système...${NC}"
echo ""

{
    echo "═══════════════════════════════════════════════════════════════"
    echo "  RAPPORT DE COMPATIBILITÉ SYSTÈME"
    echo "  Application: GNV OnBoard"
    echo "  Date: $(date)"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    
    # ============================================
    # SYSTÈME D'EXPLOITATION
    # ============================================
    echo "📋 SYSTÈME D'EXPLOITATION"
    echo "───────────────────────────────────────────────────────────────"
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS_NAME=$(lsb_release -si 2>/dev/null || echo "Linux")
        OS_VERSION=$(lsb_release -sr 2>/dev/null || echo "Unknown")
        KERNEL=$(uname -r)
        echo "OS: $OS_NAME $OS_VERSION"
        echo "Kernel: $KERNEL"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS_NAME="macOS"
        OS_VERSION=$(sw_vers -productVersion)
        KERNEL=$(uname -r)
        echo "OS: $OS_NAME $OS_VERSION"
        echo "Kernel: $KERNEL"
    else
        echo "OS: $OSTYPE"
    fi
    
    ARCH=$(uname -m)
    echo "Architecture: $ARCH"
    echo ""
    
    # ============================================
    # HARDWARE
    # ============================================
    echo "💻 HARDWARE"
    echo "───────────────────────────────────────────────────────────────"
    
    # CPU
    if [[ "$OSTYPE" == "darwin"* ]]; then
        CPU_CORES=$(sysctl -n hw.ncpu 2>/dev/null || echo "unknown")
        CPU_MODEL=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "unknown")
    else
        CPU_CORES=$(nproc 2>/dev/null || echo "unknown")
        CPU_MODEL=$(grep "model name" /proc/cpuinfo | head -1 | cut -d: -f2 | xargs || echo "unknown")
    fi
    echo "CPU: $CPU_MODEL"
    echo "Cores: $CPU_CORES"
    
    # RAM
    if [[ "$OSTYPE" == "darwin"* ]]; then
        RAM_GB=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
        RAM_TOTAL=$(sysctl -n hw.memsize | awk '{printf "%.2f", $1/1024/1024/1024/1024}')
        echo "RAM: ${RAM_GB} GB (${RAM_TOTAL} TB)"
    else
        RAM_GB=$(free -g | awk '/^Mem:/{print $2}')
        RAM_TOTAL=$(free -h | awk '/^Mem:/{print $2}')
        echo "RAM: ${RAM_GB} GB (${RAM_TOTAL})"
    fi
    
    # Disque
    DISK_TOTAL=$(df -h . | awk 'NR==2 {print $2}')
    DISK_USED=$(df -h . | awk 'NR==2 {print $3}')
    DISK_AVAIL=$(df -h . | awk 'NR==2 {print $4}')
    DISK_PERCENT=$(df -h . | awk 'NR==2 {print $5}')
    echo "Disque: Total=$DISK_TOTAL, Utilisé=$DISK_USED, Disponible=$DISK_AVAIL ($DISK_PERCENT)"
    echo ""
    
    # ============================================
    # LOGICIELS
    # ============================================
    echo "🔧 LOGICIELS INSTALLÉS"
    echo "───────────────────────────────────────────────────────────────"
    
    # Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        echo "✅ Node.js: $NODE_VERSION"
    else
        echo "❌ Node.js: Non installé"
    fi
    
    # npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm -v)
        echo "✅ npm: v$NPM_VERSION"
    else
        echo "❌ npm: Non installé"
    fi
    
    # MongoDB
    if command -v mongod &> /dev/null; then
        MONGO_VERSION=$(mongod --version 2>/dev/null | grep "db version" | awk '{print $3}' || echo "unknown")
        echo "✅ MongoDB: v$MONGO_VERSION"
    else
        echo "⚠️  MongoDB: Non installé"
    fi
    
    # Redis
    if command -v redis-server &> /dev/null; then
        REDIS_VERSION=$(redis-server --version 2>/dev/null | awk '{print $3}' | sed 's/v=//' || echo "unknown")
        echo "✅ Redis: v$REDIS_VERSION"
    else
        echo "⚠️  Redis: Non installé"
    fi
    
    # PM2
    if command -v pm2 &> /dev/null; then
        PM2_VERSION=$(pm2 -v)
        echo "✅ PM2: v$PM2_VERSION"
    else
        echo "⚠️  PM2: Non installé"
    fi
    
    # Git
    if command -v git &> /dev/null; then
        GIT_VERSION=$(git --version | awk '{print $3}')
        echo "✅ Git: v$GIT_VERSION"
    else
        echo "⚠️  Git: Non installé"
    fi
    
    echo ""
    
    # ============================================
    # PORTS
    # ============================================
    echo "🔌 PORTS"
    echo "───────────────────────────────────────────────────────────────"
    
    check_port() {
        local port=$1
        local name=$2
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "⚠️  Port $port ($name): Occupé"
        else
            echo "✅ Port $port ($name): Disponible"
        fi
    }
    
    check_port 3000 "Backend API"
    check_port 5173 "Frontend"
    check_port 27017 "MongoDB"
    check_port 6379 "Redis"
    echo ""
    
    # ============================================
    # DÉPENDANCES DU PROJET
    # ============================================
    echo "📦 DÉPENDANCES DU PROJET"
    echo "───────────────────────────────────────────────────────────────"
    
    if [ -d "backend/node_modules" ]; then
        BACKEND_DEPS=$(ls backend/node_modules 2>/dev/null | wc -l | xargs)
        echo "✅ Backend: $BACKEND_DEPS packages installés"
    else
        echo "❌ Backend: Dépendances non installées"
    fi
    
    if [ -d "node_modules" ]; then
        FRONTEND_DEPS=$(ls node_modules 2>/dev/null | wc -l | xargs)
        echo "✅ Frontend: $FRONTEND_DEPS packages installés"
    else
        echo "❌ Frontend: Dépendances non installées"
    fi
    
    if [ -d "dashboard/node_modules" ]; then
        DASHBOARD_DEPS=$(ls dashboard/node_modules 2>/dev/null | wc -l | xargs)
        echo "✅ Dashboard: $DASHBOARD_DEPS packages installés"
    else
        echo "⚠️  Dashboard: Dépendances non installées (optionnel)"
    fi
    
    echo ""
    
    # ============================================
    # CONFIGURATION
    # ============================================
    echo "⚙️  CONFIGURATION"
    echo "───────────────────────────────────────────────────────────────"
    
    if [ -f "backend/config.env" ]; then
        echo "✅ backend/config.env: Présent"
        if grep -q "DEMO_MODE=true" backend/config.env; then
            echo "   Mode: DÉMO (MongoDB non requis)"
        else
            echo "   Mode: PRODUCTION (MongoDB requis)"
        fi
    else
        echo "⚠️  backend/config.env: Absent"
    fi
    
    if [ -f ".env" ]; then
        echo "✅ .env: Présent"
    else
        echo "⚠️  .env: Absent (optionnel)"
    fi
    
    echo ""
    
    # ============================================
    # COMPATIBILITÉ PAR ENVIRONNEMENT
    # ============================================
    echo "🎯 COMPATIBILITÉ PAR ENVIRONNEMENT"
    echo "───────────────────────────────────────────────────────────────"
    
    # Développement
    echo "Développement:"
    DEV_OK=true
    if [ "$CPU_CORES" != "unknown" ] && [ "$CPU_CORES" -lt 2 ]; then
        echo "  ❌ CPU: Insuffisant (< 2 cœurs)"
        DEV_OK=false
    else
        echo "  ✅ CPU: OK"
    fi
    
    if [ -n "$RAM_GB" ] && [ "$RAM_GB" -lt 4 ]; then
        echo "  ❌ RAM: Insuffisante (< 4 GB)"
        DEV_OK=false
    else
        echo "  ✅ RAM: OK"
    fi
    
    if command -v node &> /dev/null; then
        NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$NODE_MAJOR" -lt 18 ]; then
            echo "  ❌ Node.js: Version trop ancienne (< 18.x)"
            DEV_OK=false
        else
            echo "  ✅ Node.js: OK"
        fi
    else
        echo "  ❌ Node.js: Non installé"
        DEV_OK=false
    fi
    
    if [ "$DEV_OK" = true ]; then
        echo "  Résultat: ✅ Compatible pour développement"
    else
        echo "  Résultat: ❌ Non compatible pour développement"
    fi
    
    echo ""
    
    # Staging
    echo "Staging:"
    STAGING_OK=true
    if [ "$CPU_CORES" != "unknown" ] && [ "$CPU_CORES" -lt 8 ]; then
        echo "  ⚠️  CPU: Sous-dimensionné (< 8 cœurs recommandés)"
    else
        echo "  ✅ CPU: OK"
    fi
    
    if [ -n "$RAM_GB" ] && [ "$RAM_GB" -lt 16 ]; then
        echo "  ⚠️  RAM: Sous-dimensionnée (< 16 GB recommandés)"
    else
        echo "  ✅ RAM: OK"
    fi
    
    if [ "$STAGING_OK" = true ]; then
        echo "  Résultat: ✅ Compatible pour staging"
    else
        echo "  Résultat: ⚠️  Compatible avec limitations"
    fi
    
    echo ""
    
    # Production
    echo "Production:"
    PROD_OK=true
    if [ "$CPU_CORES" != "unknown" ] && [ "$CPU_CORES" -lt 12 ]; then
        echo "  ❌ CPU: Insuffisant (< 12 cœurs requis)"
        PROD_OK=false
    else
        echo "  ✅ CPU: OK"
    fi
    
    if [ -n "$RAM_GB" ] && [ "$RAM_GB" -lt 32 ]; then
        echo "  ❌ RAM: Insuffisante (< 32 GB requis)"
        PROD_OK=false
    else
        echo "  ✅ RAM: OK"
    fi
    
    if ! command -v mongod &> /dev/null; then
        echo "  ❌ MongoDB: Requis pour production"
        PROD_OK=false
    else
        echo "  ✅ MongoDB: OK"
    fi
    
    if [ "$PROD_OK" = true ]; then
        echo "  Résultat: ✅ Compatible pour production"
    else
        echo "  Résultat: ❌ Non compatible pour production"
    fi
    
    echo ""
    
    # ============================================
    # RECOMMANDATIONS
    # ============================================
    echo "💡 RECOMMANDATIONS"
    echo "───────────────────────────────────────────────────────────────"
    
    if [ "$CPU_CORES" != "unknown" ] && [ "$CPU_CORES" -lt 4 ]; then
        echo "⚠️  Considérez une mise à niveau du CPU (4+ cœurs recommandés)"
    fi
    
    if [ -n "$RAM_GB" ] && [ "$RAM_GB" -lt 8 ]; then
        echo "⚠️  Considérez une augmentation de la RAM (8+ GB recommandés)"
    fi
    
    if ! command -v mongod &> /dev/null; then
        echo "💡 MongoDB n'est pas installé. Le mode démo est disponible."
        echo "   Pour installer MongoDB:"
        echo "   - macOS: brew install mongodb-community"
        echo "   - Linux: sudo apt install mongodb-org"
    fi
    
    if [ ! -d "backend/node_modules" ] || [ ! -d "node_modules" ]; then
        echo "💡 Installez les dépendances:"
        echo "   cd backend && npm install"
        echo "   cd .. && npm install"
    fi
    
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "Rapport généré le $(date)"
    echo "Pour plus d'informations, consultez:"
    echo "  - REQUIREMENTS-DEVELOPMENT.md (développement)"
    echo "  - REQUIREMENTS-STAGING.md (staging)"
    echo "  - SERVER-REQUIREMENTS.md (production)"
    echo "═══════════════════════════════════════════════════════════════"
    
} > "$OUTPUT_FILE"

echo -e "${GREEN}✅ Rapport généré: $OUTPUT_FILE${NC}"
echo ""
echo -e "${BLUE}💡 Pour voir le rapport:${NC}"
echo "   cat $OUTPUT_FILE"
echo "   ou"
echo "   less $OUTPUT_FILE"
