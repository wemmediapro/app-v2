# Vérification : HLS (HTTP Live Streaming) + Nginx

Ce document confirme que l’application utilise **HLS** côté lecture et que la livraison des médias peut être assurée par **Nginx** (recommandé en production).

---

## 1. HLS côté application

### Frontend (lecture)

| Élément | Fichier | Rôle |
|--------|---------|------|
| **hls.js** | `package.json` (dépendance `hls.js`) | Lecture des flux HLS (.m3u8) dans le navigateur |
| **attachVideoSource** | `src/utils/hlsVideo.js` | Attache la source vidéo : tente HLS en premier, repli sur MP4 natif |
| **getHlsUrlFromVideoUrl** | `src/services/apiService.js` | Dérive l’URL HLS : `/uploads/videos/foo.mp4` → `/uploads/videos_hls/foo/playlist.m3u8` |
| **Films / WebTV** | `src/App.jsx` | Utilise `attachVideoSource()` pour les vidéos (Films, WebTV) |

Convention : toute URL vidéo `/uploads/videos/<nom>.mp4` est jouée via l’URL HLS `/uploads/videos_hls/<nom>/playlist.m3u8` si le navigateur supporte HLS (hls.js).

### Backend (génération HLS)

| Élément | Fichier | Rôle |
|--------|---------|------|
| **encodeToHls** | `backend/src/services/hlsEncode.js` | Encode une vidéo en HLS (FFmpeg) : 480p, segments 6 s, `playlist.m3u8` + `segment_*.ts` |
| **ENABLE_HLS_STATIC** | `backend/config.env` | `true` = après chaque upload vidéo, génération HLS en arrière-plan |
| **Upload** | `backend/src/routes/upload.js` | Après compression, appelle `encodeToHls()` si `ENABLE_HLS_STATIC=true` |
| **Chemins** | `backend/src/config/index.js` | `paths.videosHls` = `public/uploads/videos_hls` |
| **Script batch** | `backend/scripts/convert-videos-to-hls.js` | Conversion en masse des MP4 existants en HLS (`npm run convert:videos-hls`) |

Les fichiers HLS sont écrits dans `backend/public/uploads/videos_hls/<basename>/` (playlist.m3u8 + segments .ts).

---

## 2. Nginx

### Rôle de Nginx

- **Reverse proxy** : API, WebSocket, frontend, dashboard.
- **Livraison des médias** (optionnelle mais recommandée) : servir `/uploads/` **directement depuis le disque** (alias) au lieu de faire passer le flux par Node. Cela réduit la charge et améliore le démarrage du streaming (vidéo, audio, **y compris HLS**).

### Fichiers de configuration

| Fichier | Usage |
|---------|--------|
| **nginx.conf** | Exemple à copier dans `/etc/nginx/sites-available/gnv-app` ; `location /uploads/` en proxy vers le backend |
| **nginx-streaming.conf.example** | Exemple avancé : Nginx sert `/uploads/` en statique (alias) avec Range et cache |
| **ansible/roles/nginx/templates/gnv-app.conf.j2** | Template Ansible : si `nginx_serve_uploads_static: true`, Nginx sert `uploads/` en alias (donc **videos_hls** inclus) |

### Comportement actuel

- **Sans option** : les requêtes vers `/uploads/` (y compris `/uploads/videos_hls/.../playlist.m3u8` et `.ts`) passent par le backend Node (express.static + middlewares de stream). **HLS fonctionne déjà**.
- **Avec `nginx_serve_uploads_static: true`** (Ansible) ou avec une config manuelle type `nginx-streaming.conf.example` : Nginx sert tout le répertoire `backend/public/uploads/` (donc **videos**, **videos_hls**, **audio**, **images**) avec `Accept-Ranges` et `Cache-Control`. **HLS est alors servi par Nginx** (recommandé pour les gros débits).

### En-tête côté backend

Dans `backend/src/routes/stream.js`, l’en-tête **`X-Accel-Buffering: no`** est envoyé pour que Nginx (en mode proxy) ne bufferise pas la réponse et laisse passer le flux en direct.

---

## 3. Types MIME HLS (Nginx)

Pour que les playlists et segments HLS soient correctement reconnus par les navigateurs, Nginx doit servir :

- **.m3u8** → `application/vnd.apple.mpegurl` ou `application/x-mpegURL`
- **.ts** → `video/MP2T`

Les configs Nginx du projet (voir ci‑dessous) incluent ces types dans `location /uploads/` pour que HLS soit valide partout.

---

## 4. Résumé

| Composant | HLS | Nginx |
|-----------|-----|--------|
| **Lecture vidéo (frontend)** | Oui (hls.js + fallback MP4) | — |
| **Génération HLS (backend)** | Oui (FFmpeg, 480p, 6 s) | — |
| **Livraison des fichiers HLS** | Oui (Node ou Nginx) | Oui si config statique `/uploads/` |
| **Proxy / reverse proxy** | — | Oui (API, WebSocket, app, dashboard) |

**Conclusion** : l’application utilise bien **HLS** pour la lecture vidéo (Films, WebTV) et la chaîne est prête pour une livraison des médias (y compris HLS) par **Nginx** en production.
