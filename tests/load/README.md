# Tests de charge GNV OnBoard

## Prérequis

- Backend sur `http://localhost:3000` (ou `API_URL`).
- [k6](https://k6.io/docs/get-started/installation/) installé pour les scénarios `.js`.
- `npm ci` à la racine (Artillery en devDependency).

### Charge WebSocket (1500+ depuis une seule IP)

Dans `config.env` du backend, augmenter par exemple :

- `MAX_CONNECTIONS_PER_IP=5000`
- `RATE_LIMIT_LOAD_TEST=1` (non pris en compte en `NODE_ENV=production`)

## Commandes

| Script                           | Description                                                  |
| -------------------------------- | ------------------------------------------------------------ |
| `npm run test:load:k6`           | k6 — profil **full** (1500 VUs, ~8 min)                      |
| `npm run test:load:k6:ci`        | k6 — profil **ci** (100 VUs)                                 |
| `npm run test:load:artillery`    | Artillery — `-e full`                                        |
| `npm run test:load:artillery:ci` | Artillery — `-e ci`                                          |
| `npm run test:load:report`       | k6 JSON + Artillery JSON + **HTML** (profil `ci` par défaut) |
| `npm run test:load`              | Ancien script léger `k6-load.js`                             |

### Variables utiles (k6)

- `API_URL` — base HTTP du backend.
- `GNV_JWT` + `GNV_USER_ID` — active Socket.io (`notifications:<userId>`).
- `LOAD_PROFILE=ci` — rampe courte + 100 VUs.

### Rapport HTML / historique

```bash
npm run test:load:report
# profil complet (long) :
LOAD_REPORT_PROFILE=full npm run test:load:report
```

Fichiers générés dans `tests/load/out/` :

- `k6-summary.json` — tendances / ingestion (Grafana, etc.)
- `artillery-report.json` — brut Artillery
- `artillery-report.html` — rapport lisible

## Artillery vs k6

- **k6** : scénario HTTP + **WebSocket Engine.IO / Socket.io** (auth JWT) proche du client réel.
- **Artillery (YAML)** : lecture simple ; HTTP + smoke `GET /socket.io/?EIO=4&transport=polling`. Socket.io binaire complet = préférer k6.

## Seuils cibles (spécification produit)

- p95 latence HTTP &lt; 500 ms
- Taux d’erreur &lt; 1 %
- Durée cible scénario 1500 VUs &lt; 10 min (k6 ≈ 8 min)
