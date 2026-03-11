#!/bin/bash

# Script pour récupérer les URLs des tunnels Cloudflare actifs

echo "🔍 Recherche des tunnels Cloudflare actifs..."
echo ""

# Chercher les processus cloudflared et extraire les URLs depuis leurs logs
ps aux | grep cloudflared | grep -v grep | while read line; do
    PID=$(echo $line | awk '{print $2}')
    PORT=$(echo $line | grep -oE 'localhost:[0-9]+' | cut -d: -f2)
    
    if [ -n "$PORT" ]; then
        if [ "$PORT" = "5173" ]; then
            SERVICE="Frontend"
        elif [ "$PORT" = "5174" ]; then
            SERVICE="Dashboard"
        else
            SERVICE="Port $PORT"
        fi
        
        echo "📱 $SERVICE (PID: $PID, Port: $PORT)"
        echo "   🌐 URL: En cours de génération..."
        echo ""
    fi
done

echo "💡 Les URLs complètes apparaîtront dans les logs des processus cloudflared"
echo "📋 Pour voir les logs: lsof -p <PID> | grep -i log"
