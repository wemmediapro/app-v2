# HLS statique — spécifications

| Spécification | Valeur |
|---------------|--------|
| **HLS statique** | Une seule qualité, pas de variantes multiples |
| **Résolution** | 480p (854×480) |
| **Segments** | 6 secondes |
| **Adaptive bitrate** | Non (inutile offline) |
| **Cache disque** | SSD NVMe recommandé pour `uploads/videos_hls/` |

Vidéos servies en **HLS statique** pour un démarrage rapide et un cache disque efficace (SSD NVMe recommandé).

---

## Backend

### Encodage

- **Service** : `backend/src/services/hlsEncode.js`
  - `encodeToHls(inputPath)` : encode un fichier vidéo (MP4, etc.) en HLS dans `public/uploads/videos_hls/<basename>/` (playlist.m3u8 + segment_000.ts, …).
  - FFmpeg en ligne de commande : `-hls_time 6`, `-vf scale=854:480`, pas de variantes multiples.

### Activation après upload

- Variable d’environnement : **`ENABLE_HLS_STATIC=true`**
- Quand elle est définie, chaque vidéo compressée (upload) est aussi convertie en HLS en arrière-plan (sans bloquer la réponse API).

### Conversion en batch (vidéos déjà présentes)

```bash
cd backend
node scripts/convert-videos-to-hls.js
# ou avec liste à blanc :
node scripts/convert-videos-to-hls.js --dry-run
```

Script npm : **`npm run convert:videos-hls`** (depuis `backend/`).

---

## Frontend

- **hls.js** : chargement dynamique de l’URL HLS dérivée à partir de l’URL MP4.
- Convention : `/uploads/videos/foo.mp4` → `/uploads/videos_hls/foo/playlist.m3u8`
- Si l’URL HLS existe et que le navigateur supporte HLS (hls.js), la lecture utilise le HLS ; sinon repli sur le MP4 natif.

---

## Nginx et cache disque SSD NVMe

- Les fichiers HLS sont sous **`/uploads/videos_hls/`** (donc déjà couverts par `location /uploads/` si vous servez les uploads en statique).
- Pour tirer parti du **cache disque SSD NVMe** :
  1. Monter ou lier le répertoire des uploads sur un disque NVMe (ex. `/mnt/nvme/uploads` → `backend/public/uploads` ou au moins `backend/public/uploads/videos_hls`).
  2. Ou déployer l’application avec `app_deploy_path` (Ansible) pointant vers un chemin sur NVMe.

Exemple (optionnel) : cache proxy Nginx pour les segments :

```nginx
proxy_cache_path /var/cache/nginx/gnv_hls levels=1:2 keys_zone=gnv_hls:32m max_size=10g inactive=7d use_temp_path=off;
# Puis dans location /uploads/videos_hls/ :
# proxy_cache gnv_hls;
# proxy_cache_valid 200 24h;
```

Placer le répertoire **`/var/cache/nginx/gnv_hls`** sur NVMe si vous utilisez ce cache.

### Vérifier que le cache HLS est bien sur SSD NVMe

Sur le serveur (ou en SSH) :

1. **Chemin réel des HLS** (depuis la racine du backend) :
   ```bash
   cd backend
   realpath public/uploads/videos_hls 2>/dev/null || readlink -f public/uploads/videos_hls
   ```

2. **Point de montage et type de disque** :
   ```bash
   df -T --output=source,fstype,target "$(realpath backend/public/uploads/videos_hls 2>/dev/null || echo backend/public/uploads/videos_hls)"
   ```
   Si le répertoire est un lien symbolique, utiliser le chemin résolu dans `df`.

3. **Vérifier qu’un bloc est bien NVMe** (Linux) :
   ```bash
   lsblk -d -o NAME,ROTA,SIZE,MODEL | grep -E 'nvme|NAME'
   ```
   `ROTA=0` indique un disque non rotatif (SSD). Les devices `nvme*n*` sont des SSD NVMe.

4. **Optionnel — script de vérification** (à exécuter depuis la racine du projet) :
   ```bash
   HLS_DIR="backend/public/uploads/videos_hls"
   if [ -d "$HLS_DIR" ]; then
     echo "Répertoire HLS: $(realpath "$HLS_DIR" 2>/dev/null || echo "$HLS_DIR")"
     df -h "$(realpath "$HLS_DIR" 2>/dev/null)" 2>/dev/null || df -h "$HLS_DIR"
   else
     echo "Répertoire $HLS_DIR absent (encore aucune vidéo encodée en HLS)."
   fi
   ```

Si `videos_hls` ou le volume affiché par `df` correspond à un point de montage sur un device NVMe (ex. `/mnt/nvme`), le cache disque est bien sur SSD NVMe.

---

## Fichiers concernés

- Backend : `backend/src/services/hlsEncode.js`, `backend/src/routes/upload.js`, `backend/scripts/convert-videos-to-hls.js`, `backend/src/config/index.js`, `backend/server.js`
- Frontend : `src/utils/hlsVideo.js`, `src/services/apiService.js` (getHlsUrlFromVideoUrl), `src/App.jsx` (attachVideoSource pour Films et WebTV)
- Prérequis : **FFmpeg** installé sur le serveur (même que pour la compression 480p).
