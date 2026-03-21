# Guide de réglage des performances

Objectif : donner des **leviers concrets** déjà présents dans le codebase, sans remplacer un run de profilage sur votre charge réelle.

## Processus Node

| Levier       | Où / comment                                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mémoire heap | Script prod : `npm run start:prod` utilise `NODE_OPTIONS='--max-old-space-size=2048'` et `UV_THREADPOOL_SIZE=16` (`backend/package.json`). Ajuster selon RAM VM / conteneur. |
| Cluster      | `npm run start:cluster` — plusieurs workers derrière le même port (voir `backend/cluster.js`).                                                                               |

## Données & cache

- **Redis** : cache listes publiques (ex. films sans `Authorization`), invalidations côté mutations — voir `backend/src/lib/cache-manager.js` et usages dans `movies.js`, etc.
- **Lectures MongoDB** : `.read('secondaryPreferred')` sur certaines listes pour délester le primaire (ex. restaurants, radio, films).
- **Pagination** : middleware `paginate` / `validatePagination` — plafonds `limit` pour éviter réponses énormes (films : défaut 20, max 100).

## Limites & sockets

- **Rate limiting** : variables `RATE_LIMIT_*`, `LOGIN_RATE_LIMIT_MAX`, `SOCKET_RATE_*`, `MAX_CONNECTIONS_PER_IP` — documentées dans `SECURITY.md` et `config.env` / `backend/src/config`.
- **Charge** : pour les campagnes k6, `RATE_LIMIT_LOAD_TEST=1` et relever `MAX_CONNECTIONS_PER_IP` **uniquement hors production** — voir `tests/load/README.md`.

## Observabilité

- **Health** : `GET /api/v1/health` (liveness, mémoire, connexions) ; `GET /api/v1/health/ready` (readiness MongoDB).
- **Métriques** : route ` /api/v1/metrics` (selon configuration — ne pas exposer publiquement sans protection).
- **Mémoire** : module `backend/src/lib/memory-monitor.js` si activé dans votre déploiement.

## Tests de charge

```bash
# depuis la racine — voir package.json pour les noms exacts
npm run test:load:k6:ci
```

Seuils cibles (produit) : p95 HTTP &lt; 500 ms, erreurs &lt; 1 % — détail dans `tests/load/README.md`.

## Micro-benchmarks (CPU, reproductibles)

| Cible                         | Commande                      | Rôle                                                                                                                                    |
| ----------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend (Vitest + Tinybench) | `npm run test:bench`          | Ex. sanitization HTML (`src/tests/perf/sanitize.bench.js`) — repère les régressions sur le chemin magazine.                             |
| Backend (scripts Node)        | `cd backend && npm run bench` | Regex tunnel, liste publique, gzip, cache JWT (`bench-middleware-helpers.js`) ; simulation hit cache auth (`bench-auth-user-cache.js`). |

Les micro-benchmarks mesurent surtout le **coût CPU** sur une machine donnée ; pour la latence bout-en-bout, combiner avec **k6** et les métriques `/api/v1/health` / Prometheus. Vitest affiche un avertissement « experimental » sur `bench` : épingler la version de Vitest en CI si vous vous y fiez.

## Fichiers & médias

- **HLS / vidéo** : en production, servir les segments via Nginx ou CDN plutôt que de tout faire transiter par Node — voir `docs/VERIFICATION-HLS-NGINX.md`.
- **Images** : scripts de compression / redimensionnement dans `backend/package.json` (`compress:images`, `resize:movies-posters`, etc.).

## Méthode recommandée

1. Mesurer (k6 + métriques OS / Mongo / Redis).
2. Identifier le goulet (CPU Node, I/O disque, DB, réseau).
3. Appliquer **un** changement à la fois (cache, index Mongo, scaling horizontal, static files).

## Profiling (CPU / heap / Inspector)

Procédures détaillées : [PROFILING.md](./PROFILING.md) — `npm run profile:backend:cpu` / `profile:backend:heap`, `dev:inspect`, Playwright `--trace`, `build:analyze`.
