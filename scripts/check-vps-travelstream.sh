#!/bin/bash
# Diagnostic du VPS pour travelstream.fr (ERR_CONNECTION_REFUSED).
# Usage: ./scripts/check-vps-travelstream.sh

set -e
VPS="${VPS:-root@187.77.168.205}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
if [ -z "$SSHPASS" ] && [ -f "$SRC/.vps-pass" ]; then
  export SSHPASS="$(cat "$SRC/.vps-pass")"
fi
[ -z "$SSHPASS" ] && { echo "Définir SSHPASS ou créer .vps-pass"; exit 1; }
command -v sshpass &>/dev/null || { echo "Installez sshpass"; exit 1; }
SSH_E="sshpass -e ssh -o StrictHostKeyChecking=no"

echo "=== Diagnostic VPS $VPS ==="
echo ""

echo "--- 1. Résolution DNS travelstream.fr ---"
dig +short travelstream.fr A 2>/dev/null || nslookup travelstream.fr 2>/dev/null || echo "dig/nslookup non dispo"
echo ""

echo "--- 2. Sur le VPS : Nginx, ports 80/443, PM2, pare-feu ---"
$SSH_E "$VPS" "echo 'Nginx actif ?'; systemctl is-active nginx 2>/dev/null || echo 'nginx inactif ou non installé'; echo ''; echo 'Processus en écoute 80/443:'; ss -tlnp 2>/dev/null | grep -E ':80|:443' || netstat -tlnp 2>/dev/null | grep -E ':80|:443'; echo ''; echo 'PM2:'; pm2 list 2>/dev/null || echo 'PM2 non dispo'; echo ''; echo 'Pare-feu (ufw):'; ufw status 2>/dev/null || echo 'ufw non dispo'; echo ''; echo 'Sites Nginx activés:'; ls -la /etc/nginx/sites-enabled/ 2>/dev/null"
echo ""
echo "=== Fin diagnostic ==="
