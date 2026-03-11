#!/bin/bash

# Script de vérification automatique des exigences système
# Usage: ./check-system-requirements.sh [environment]
# Environments: development, staging, production

set -e

ENVIRONMENT=${1:-development}

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Compteurs
PASSED=0
FAILED=0
WARNINGS=0

echo "═══════════════════════════════════════════════════════════════"
echo "  VÉRIFICATION DES EXIGENCES SYSTÈME"
ENV_UPPER=$(echo "$ENVIRONMENT" | tr '[:lower:]' '[:upper:]')
echo "  Environnement: $ENV_UPPER"
echo "  Date: $(date)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Fonction pour vérifier une condition
check() {
    local name="$1"
    local command="$2"
    local required="$3"
    local current="$4"
    local comparison="$5"  # ">=", "==", "<="
    
    echo -n "🔍 Vérification: $name... "
    
    if eval "$command" > /dev/null 2>&1; then
        if [ -n "$comparison" ] && [ -n "$current" ] && [ -n "$required" ]; then
            case "$comparison" in
                ">=")
                    if (( $(echo "$current >= $required" | bc -l) )); then
                        echo -e "${GREEN}✅ OK${NC} ($current >= $required)"
                        ((PASSED++))
                    else
                        echo -e "${RED}❌ ÉCHEC${NC} ($current < $required requis)"
                        ((FAILED++))
                    fi
                    ;;
                "==")
                    if [ "$current" == "$required" ]; then
                        echo -e "${GREEN}✅ OK${NC} ($current)"
                        ((PASSED++))
                    else
                        echo -e "${YELLOW}⚠️  ATTENTION${NC} ($current au lieu de $required)"
                        ((WARNINGS++))
                    fi
                    ;;
            esac
        else
            echo -e "${GREEN}✅ OK${NC}"
            ((PASSED++))
        fi
    else
        echo -e "${RED}❌ ÉCHEC${NC}"
        ((FAILED++))
    fi
}

# Fonction pour obtenir la version d'un logiciel
get_version() {
    local cmd="$1"
    local version_cmd="$2"
    if command -v "$cmd" &> /dev/null; then
        eval "$version_cmd" 2>/dev/null | head -1
    else
        echo "non installé"
    fi
}

# ============================================
# 1. SYSTÈME D'EXPLOITATION
# ============================================
echo -e "${CYAN}📋 1. SYSTÈME D'EXPLOITATION${NC}"
echo "───────────────────────────────────────────────────────────────"

# OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS_NAME=$(lsb_release -si 2>/dev/null || echo "Linux")
    OS_VERSION=$(lsb_release -sr 2>/dev/null || echo "Unknown")
    echo -e "   OS: ${GREEN}✅ $OS_NAME $OS_VERSION${NC}"
    ((PASSED++))
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS_NAME="macOS"
    OS_VERSION=$(sw_vers -productVersion)
    echo -e "   OS: ${GREEN}✅ $OS_NAME $OS_VERSION${NC}"
    ((PASSED++))
else
    echo -e "   OS: ${YELLOW}⚠️  $OSTYPE (non testé)${NC}"
    ((WARNINGS++))
fi

# Architecture
ARCH=$(uname -m)
if [ "$ARCH" == "x86_64" ] || [ "$ARCH" == "arm64" ]; then
    echo -e "   Architecture: ${GREEN}✅ $ARCH${NC}"
    ((PASSED++))
else
    echo -e "   Architecture: ${YELLOW}⚠️  $ARCH${NC}"
    ((WARNINGS++))
fi

# Kernel (Linux uniquement)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    KERNEL=$(uname -r)
    echo -e "   Kernel: ${GREEN}✅ $KERNEL${NC}"
    ((PASSED++))
fi

echo ""

# ============================================
# 2. HARDWARE
# ============================================
echo -e "${CYAN}💻 2. HARDWARE${NC}"
echo "───────────────────────────────────────────────────────────────"

# CPU
CPU_CORES=$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo "unknown")
if [ "$CPU_CORES" != "unknown" ]; then
    if [ "$ENVIRONMENT" == "production" ]; then
        if [ "$CPU_CORES" -ge 12 ]; then
            echo -e "   CPU Cores: ${GREEN}✅ $CPU_CORES${NC} (>= 12 requis pour production)"
            ((PASSED++))
        else
            echo -e "   CPU Cores: ${RED}❌ $CPU_CORES${NC} (< 12 requis pour production)"
            ((FAILED++))
        fi
    elif [ "$ENVIRONMENT" == "staging" ]; then
        if [ "$CPU_CORES" -ge 8 ]; then
            echo -e "   CPU Cores: ${GREEN}✅ $CPU_CORES${NC} (>= 8 requis pour staging)"
            ((PASSED++))
        else
            echo -e "   CPU Cores: ${YELLOW}⚠️  $CPU_CORES${NC} (< 8 recommandé pour staging)"
            ((WARNINGS++))
        fi
    else
        echo -e "   CPU Cores: ${GREEN}✅ $CPU_CORES${NC}"
        ((PASSED++))
    fi
else
    echo -e "   CPU Cores: ${YELLOW}⚠️  Impossible à détecter${NC}"
    ((WARNINGS++))
fi

# RAM
if [[ "$OSTYPE" == "darwin"* ]]; then
    RAM_GB=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
else
    RAM_GB=$(free -g | awk '/^Mem:/{print $2}')
fi

if [ -n "$RAM_GB" ] && [ "$RAM_GB" -gt 0 ]; then
    if [ "$ENVIRONMENT" == "production" ]; then
        if [ "$RAM_GB" -ge 32 ]; then
            echo -e "   RAM: ${GREEN}✅ ${RAM_GB} GB${NC} (>= 32 GB requis pour production)"
            ((PASSED++))
        else
            echo -e "   RAM: ${RED}❌ ${RAM_GB} GB${NC} (< 32 GB requis pour production)"
            ((FAILED++))
        fi
    elif [ "$ENVIRONMENT" == "staging" ]; then
        if [ "$RAM_GB" -ge 16 ]; then
            echo -e "   RAM: ${GREEN}✅ ${RAM_GB} GB${NC} (>= 16 GB requis pour staging)"
            ((PASSED++))
        else
            echo -e "   RAM: ${YELLOW}⚠️  ${RAM_GB} GB${NC} (< 16 GB recommandé pour staging)"
            ((WARNINGS++))
        fi
    else
        if [ "$RAM_GB" -ge 4 ]; then
            echo -e "   RAM: ${GREEN}✅ ${RAM_GB} GB${NC} (>= 4 GB requis pour développement)"
            ((PASSED++))
        else
            echo -e "   RAM: ${RED}❌ ${RAM_GB} GB${NC} (< 4 GB requis)"
            ((FAILED++))
        fi
    fi
else
    echo -e "   RAM: ${YELLOW}⚠️  Impossible à détecter${NC}"
    ((WARNINGS++))
fi

# Disque
DISK_AVAIL=$(df -h . | awk 'NR==2 {print $4}' | sed 's/G//')
if [ -n "$DISK_AVAIL" ]; then
    DISK_AVAIL_NUM=$(echo "$DISK_AVAIL" | sed 's/[^0-9]//g')
    if [ "$ENVIRONMENT" == "production" ]; then
        if [ "$DISK_AVAIL_NUM" -ge 100 ]; then
            echo -e "   Disque disponible: ${GREEN}✅ ${DISK_AVAIL}${NC} (>= 100 GB requis)"
            ((PASSED++))
        else
            echo -e "   Disque disponible: ${YELLOW}⚠️  ${DISK_AVAIL}${NC} (< 100 GB recommandé)"
            ((WARNINGS++))
        fi
    else
        if [ "$DISK_AVAIL_NUM" -ge 10 ]; then
            echo -e "   Disque disponible: ${GREEN}✅ ${DISK_AVAIL}${NC}"
            ((PASSED++))
        else
            echo -e "   Disque disponible: ${YELLOW}⚠️  ${DISK_AVAIL}${NC} (< 10 GB)"
            ((WARNINGS++))
        fi
    fi
fi

echo ""

# ============================================
# 3. LOGICIELS REQUIS
# ============================================
echo -e "${CYAN}🔧 3. LOGICIELS REQUIS${NC}"
echo "───────────────────────────────────────────────────────────────"

# Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        echo -e "   Node.js: ${GREEN}✅ v$NODE_VERSION${NC} (>= 18.x requis)"
        ((PASSED++))
    else
        echo -e "   Node.js: ${RED}❌ v$NODE_VERSION${NC} (< 18.x requis)"
        ((FAILED++))
    fi
else
    echo -e "   Node.js: ${RED}❌ Non installé${NC}"
    ((FAILED++))
fi

# npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "   npm: ${GREEN}✅ v$NPM_VERSION${NC}"
    ((PASSED++))
else
    echo -e "   npm: ${RED}❌ Non installé${NC}"
    ((FAILED++))
fi

# MongoDB (optionnel pour développement avec mode démo)
if command -v mongod &> /dev/null; then
    MONGO_VERSION=$(mongod --version 2>/dev/null | grep "db version" | awk '{print $3}' || echo "unknown")
    echo -e "   MongoDB: ${GREEN}✅ v$MONGO_VERSION${NC}"
    ((PASSED++))
elif [ "$ENVIRONMENT" == "development" ]; then
    echo -e "   MongoDB: ${YELLOW}⚠️  Non installé (mode démo disponible)${NC}"
    ((WARNINGS++))
else
    echo -e "   MongoDB: ${RED}❌ Non installé${NC}"
    ((FAILED++))
fi

# Redis (optionnel pour développement)
if command -v redis-server &> /dev/null; then
    REDIS_VERSION=$(redis-server --version 2>/dev/null | awk '{print $3}' | sed 's/v=//' || echo "unknown")
    echo -e "   Redis: ${GREEN}✅ v$REDIS_VERSION${NC}"
    ((PASSED++))
elif [ "$ENVIRONMENT" == "development" ]; then
    echo -e "   Redis: ${YELLOW}⚠️  Non installé (optionnel pour développement)${NC}"
    ((WARNINGS++))
else
    echo -e "   Redis: ${YELLOW}⚠️  Non installé (recommandé pour production)${NC}"
    ((WARNINGS++))
fi

# PM2 (optionnel pour développement)
if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 -v)
    echo -e "   PM2: ${GREEN}✅ v$PM2_VERSION${NC}"
    ((PASSED++))
elif [ "$ENVIRONMENT" == "development" ]; then
    echo -e "   PM2: ${YELLOW}⚠️  Non installé (optionnel pour développement)${NC}"
    ((WARNINGS++))
else
    echo -e "   PM2: ${YELLOW}⚠️  Non installé (recommandé pour production)${NC}"
    ((WARNINGS++))
fi

# Git
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | awk '{print $3}')
    echo -e "   Git: ${GREEN}✅ v$GIT_VERSION${NC}"
    ((PASSED++))
else
    echo -e "   Git: ${YELLOW}⚠️  Non installé${NC}"
    ((WARNINGS++))
fi

echo ""

# ============================================
# 4. PORTS DISPONIBLES
# ============================================
echo -e "${CYAN}🔌 4. PORTS DISPONIBLES${NC}"
echo "───────────────────────────────────────────────────────────────"

check_port() {
    local port=$1
    local name=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "   Port $port ($name): ${YELLOW}⚠️  Occupé${NC}"
        ((WARNINGS++))
    else
        echo -e "   Port $port ($name): ${GREEN}✅ Disponible${NC}"
        ((PASSED++))
    fi
}

check_port 3000 "Backend API"
check_port 5173 "Frontend"
check_port 27017 "MongoDB"
check_port 6379 "Redis"

echo ""

# ============================================
# 5. DÉPENDANCES DU PROJET
# ============================================
echo -e "${CYAN}📦 5. DÉPENDANCES DU PROJET${NC}"
echo "───────────────────────────────────────────────────────────────"

if [ -d "backend/node_modules" ]; then
    echo -e "   Backend dependencies: ${GREEN}✅ Installées${NC}"
    ((PASSED++))
else
    echo -e "   Backend dependencies: ${YELLOW}⚠️  Non installées${NC}"
    echo -e "      💡 Exécutez: cd backend && npm install"
    ((WARNINGS++))
fi

if [ -d "node_modules" ]; then
    echo -e "   Frontend dependencies: ${GREEN}✅ Installées${NC}"
    ((PASSED++))
else
    echo -e "   Frontend dependencies: ${YELLOW}⚠️  Non installées${NC}"
    echo -e "      💡 Exécutez: npm install"
    ((WARNINGS++))
fi

if [ -d "dashboard/node_modules" ]; then
    echo -e "   Dashboard dependencies: ${GREEN}✅ Installées${NC}"
    ((PASSED++))
else
    echo -e "   Dashboard dependencies: ${YELLOW}⚠️  Non installées${NC}"
    echo -e "      💡 Exécutez: cd dashboard && npm install"
    ((WARNINGS++))
fi

echo ""

# ============================================
# 6. CONFIGURATION
# ============================================
echo -e "${CYAN}⚙️  6. CONFIGURATION${NC}"
echo "───────────────────────────────────────────────────────────────"

if [ -f "backend/config.env" ]; then
    echo -e "   backend/config.env: ${GREEN}✅ Présent${NC}"
    ((PASSED++))
else
    echo -e "   backend/config.env: ${YELLOW}⚠️  Absent${NC}"
    echo -e "      💡 Créez le fichier depuis backend/env.example"
    ((WARNINGS++))
fi

if [ -f ".env" ]; then
    echo -e "   .env: ${GREEN}✅ Présent${NC}"
    ((PASSED++))
else
    echo -e "   .env: ${YELLOW}⚠️  Absent (optionnel)${NC}"
    ((WARNINGS++))
fi

echo ""

# ============================================
# RÉSUMÉ
# ============================================
echo "═══════════════════════════════════════════════════════════════"
echo -e "${CYAN}📊 RÉSUMÉ${NC}"
echo "═══════════════════════════════════════════════════════════════"
echo -e "   ${GREEN}✅ Réussis: $PASSED${NC}"
echo -e "   ${RED}❌ Échecs: $FAILED${NC}"
echo -e "   ${YELLOW}⚠️  Avertissements: $WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅ Tous les prérequis sont satisfaits !${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Système prêt avec quelques avertissements${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌ Certains prérequis critiques ne sont pas satisfaits${NC}"
    echo ""
    echo "💡 Actions recommandées:"
    echo "   1. Installez les logiciels manquants"
    echo "   2. Vérifiez la configuration"
    echo "   3. Consultez SERVER-REQUIREMENTS.md pour plus de détails"
    exit 1
fi
