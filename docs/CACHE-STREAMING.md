# Stratégie de cache pour le streaming (vidéo / radio)

Ce document décrit pourquoi le streaming peut encore sembler lent et comment le cache est configuré pour l’améliorer.

---

## 1. Où peut venir la lenteur ?

| Cause                         | Ce qui a été fait / à faire                                                                                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pas de cache HTTP long**    | Backend et Nginx envoient maintenant `max-age=86400` (24 h) + `stale-while-revalidate=3600`.                                                                                             |
| **Médias servis par Node**    | Activer la livraison directe par Nginx : `nginx_serve_uploads_static: true` (Ansible) ou `location /uploads/` avec `alias` (voir `docs/NGINX-STREAMING-SERVEUR.md`).                     |
| **Cache navigateur court**    | `Cache-Control` passé à 24 h + `stale-while-revalidate` pour que le navigateur réutilise le cache tout en revalidant en arrière-plan.                                                    |
| **Service Worker sans 206**   | PWA met en cache les réponses 200/206 pour `/uploads/` (CacheFirst, 7 jours, 80 entrées). Les requêtes Range sont prises en compte via `cacheableResponse: { statuses: [0, 200, 206] }`. |
| **Premier octet lent (TTFB)** | Buffer Node à 128 Ko, Nginx avec `proxy_request_buffering off` et timeouts longs pour `/api/stream/` et `/uploads/`.                                                                     |

---

## 2. Cache actuel (couches)

### A. Backend (Node) — `backend/src/routes/stream.js`

- **En-têtes** : `Cache-Control: public, max-age=86400, stale-while-revalidate=3600`
- **ETag** + **304 Not Modified** si le client envoie `If-None-Match` / `If-Modified-Since`
- Utilisé quand la requête passe par Node (ex. `/api/stream/video/...` si le front l’utilise encore)

### B. Nginx

- **Si `nginx_serve_uploads_static: true`** : Nginx sert les fichiers depuis le disque (`alias`), avec  
  `Cache-Control: public, max-age=86400, stale-while-revalidate=3600` et `Accept-Ranges: bytes`.
- **Si proxy vers Node** : mêmes en-têtes Cache-Control ajoutés sur la réponse.
- Aucun **proxy_cache** (cache disque Nginx) par défaut ; optionnel (voir § 4).

### C. Navigateur

- Respecte `Cache-Control` : garde la réponse en cache 24 h, peut servir du cache tout en revalidant pendant 1 h (`stale-while-revalidate`).
- Pour les vidéos/audios servis sous `/uploads/`, les relectures et les reprises sont donc plus rapides.

### D. Service Worker (PWA)

- **Runtime cache** pour les URLs `/uploads/(videos|audio|images)/` :
  - Stratégie : **CacheFirst**
  - Cache : `gnv-offline-media`, 80 entrées max, 7 jours
  - Réponses mises en cache : 200 et 206 (pour le streaming avec Range)
- Après un premier chargement, les médias peuvent être lus depuis le cache (y compris offline si l’URL a été chargée une fois).

---

## 3. Vérifications rapides

- **En-têtes sur une vidéo** :  
  Requête GET vers une URL du type `https://votre-domaine.com/uploads/videos/xxx.mp4`  
  → Réponse doit contenir :  
  `Cache-Control: public, max-age=86400, stale-while-revalidate=3600` et `Accept-Ranges: bytes`.
- **Nginx sert bien les médias** :  
  Vérifier que la config active utilise bien `location /uploads/` avec `alias` (pas seulement `proxy_pass`) si vous avez activé la livraison statique.
- **Relecture** :  
  Ouvrir la même vidéo deux fois : la 2e fois doit être plus rapide (cache navigateur ou SW).

---

## 4. Option : cache disque Nginx (proxy_cache)

Si une partie du trafic passe encore par un proxy Nginx vers Node (par ex. `/api/stream/` ou ancienne config sans alias), vous pouvez ajouter un cache disque Nginx pour réduire la charge et accélérer les réponses répétées.

- **À placer dans le bloc `http`** (souvent dans `/etc/nginx/nginx.conf`) :

```nginx
proxy_cache_path /var/cache/nginx/gnv_media
                  levels=1:2
                  keys_zone=gnv_media:64m
                  max_size=2g
                  inactive=7d
                  use_temp_path=off;
```

- **Dans le bloc `server`**, dans la `location` qui fait `proxy_pass` vers le backend (stream ou uploads) :

```nginx
proxy_cache gnv_media;
proxy_cache_key $uri$is_args$args;
proxy_cache_valid 200 206 24h;
proxy_cache_use_stale error timeout updating;
add_header X-Cache-Status $upstream_cache_status;
```

- **Important** : avec `proxy_cache`, Nginx doit pouvoir mettre en cache la réponse (buffering). Pour le streaming Range, chaque plage (206) est une entrée de cache différente ; ça fonctionne mais peut utiliser beaucoup d’entrées pour une même vidéo.
- Créer le répertoire :  
  `sudo mkdir -p /var/cache/nginx/gnv_media && sudo chown www-data:www-data /var/cache/nginx/gnv_media`  
  (adapter l’utilisateur Nginx si besoin).

---

## 5. Résumé des fichiers modifiés pour le cache

- `backend/src/routes/stream.js` : `Cache-Control` 24 h + `stale-while-revalidate`
- `nginx.conf` : `Cache-Control` sur `location /uploads/` (proxy)
- `ansible/roles/nginx/templates/gnv-app.conf.j2` : `Cache-Control` pour `/uploads/` (alias et proxy)
- `vite.config.js` : runtime cache PWA médias (CacheFirst, 200/206, 7 j, 80 entrées)
- `nginx-streaming.conf.example` : exemple avec `Cache-Control` long

Après déploiement, redémarrer le backend et recharger Nginx pour appliquer les changements.
