#!/usr/bin/env bash
# Vérifie que le répertoire HLS (cache vidéo) existe et sur quel disque il se trouve.
# Pour confirmer un cache sur SSD NVMe : lancer sur le serveur et vérifier que df pointe vers un volume NVMe (lsblk).

HLS_DIR="backend/public/uploads/videos_hls"
if [ -d "$HLS_DIR" ]; then
  RESOLVED=$(realpath "$HLS_DIR" 2>/dev/null || readlink -f "$HLS_DIR" 2>/dev/null || echo "$HLS_DIR")
  echo "Répertoire HLS: $RESOLVED"
  df -h "$RESOLVED" 2>/dev/null || df -h "$HLS_DIR"
else
  echo "Répertoire $HLS_DIR absent."
fi
