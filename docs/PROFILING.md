# Profiling — backend Node, front React, charge

Ce guide décrit comment **capturer des profils CPU / mémoire** utiles pour diagnostiquer la pile GNV (Express, Mongo, Redis, Socket.io), sans dépendances payantes.

## Backend — V8 (fichiers `.cpuprofile` / `.heapprofile`)

Node 18+ expose `--cpu-prof` et `--heap-prof`. Les traces sont écrites **à l’arrêt du process** dans `backend/profile-out/` (répertoire ignoré par Git).

| Commande                             | Effet                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `cd backend && npm run profile:cpu`  | Échantillonnage CPU jusqu’à Ctrl+C ; ouvrir le `.cpuprofile` dans Chrome DevTools. |
| `cd backend && npm run profile:heap` | Échantillonnage heap (allocation) jusqu’à Ctrl+C ; ouvrir le `.heapprofile`.       |
| Depuis la racine                     | `npm run profile:backend:cpu` ou `npm run profile:backend:heap`                    |

**Scénario typique**

1. Terminal A : `cd backend && npm run profile:cpu` (serveur démarre avec le profiler).
2. Terminal B : charge HTTP — ex. `npm run test:load:api:ci` (racine) ou `curl` répété sur `/api/v1/health`.
3. Terminal A : **Ctrl+C** → fichier généré dans `backend/profile-out/`.

**Lecture des fichiers**

- Chrome → **F12** → onglet **Performance** (ou **Memory** selon version) → menu **Load profile** / importer le fichier.
- Ou VS Code : extensions type « Chrome Profiler » / analyse des `.cpuprofile`.

**Limites**

- Profil = **un seul process** ; avec `cluster.js`, profiler **un worker** ou désactiver le cluster le temps de la capture.
- En production, éviter d’activer le profiler en continu (surcharge I/O disque) ; préférer une **fenêtre courte** sur un clone de charge (staging).

## Backend — Inspector (breakpoints, heap snapshot manuel)

| Commande                              | Usage                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `cd backend && npm run dev:inspect`   | Nodemon + `--inspect` sur `0.0.0.0:9229` (pratique en LAN / conteneur avec port publié). |
| `cd backend && npm run start:inspect` | Même chose sans reload (process unique).                                                 |

Dans Chrome : `chrome://inspect` → **Open dedicated DevTools for Node** → onglets **Profiler**, **Memory** (heap snapshots), **Sources**.

## Frontend — React / Vite

- **React Profiler** (extension React DevTools) : enregistrer un commit sur un parcours utilisateur (navigation, liste, magazine).
- **Bundle** : `npm run build:analyze` (racine) — graphe Rollup pour repérer les chunks lourds.
- **Vitest bench** : `npm run test:bench` — micro-benchmarks CPU (ex. sanitization HTML), voir [PERFORMANCE.md](./PERFORMANCE.md).

## E2E — Playwright

Les traces Playwright (screenshots, network, timeline) aident pour les lenteurs **côté navigateur** :

```bash
npx playwright test --trace on
```

Puis `npx playwright show-trace trace.zip` (fichier indiqué dans la sortie du run).

## Compléments

- Charge réseau / latence API : **k6** — `tests/load/README.md`.
- Checklist prod / logs : [OPS-RUNBOOK.md](./OPS-RUNBOOK.md).
- Outils tiers optionnels (non inclus dans le dépôt) : [0x](https://www.npmjs.com/package/0x), [Clinic.js](https://clinicjs.org/) pour des rapports HTML plus poussés sur un même process.
