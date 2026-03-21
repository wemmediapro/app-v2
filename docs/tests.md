# Stratégie de tests (GNV OnBoard)

Ce document complète le commentaire dans `backend/jest.config.js` (référence `voir docs/tests.md`).

## Périmètre mesuré aujourd’hui

Jest ne collecte la couverture que sur les fichiers listés dans `backend/jest.config.js` → `collectCoverageFrom` (routes et middleware « critiques », modèles associés). Les autres fichiers peuvent être testés sans apparaître dans le pourcentage global affiché tant qu’ils ne sont pas ajoutés à cette liste.

## Commandes utiles

| Contexte                              | Commande                                 |
| ------------------------------------- | ---------------------------------------- |
| Backend (Jest + couverture périmètre) | `cd backend && npm test`                 |
| Front (Vitest)                        | `npm run test:coverage` (racine du repo) |
| E2E                                   | `npm run test:e2e` (racine)              |
| Vérifier l’API locale                 | `npm run verify` (racine)                |

## CI

Les workflows GitHub Actions sous `.github/workflows/` exécutent notamment les tests front, backend, typecheck et (sur le job front) Playwright. La couverture peut être envoyée vers Codecov si le secret `CODECOV_TOKEN` est configuré — voir `docs/GITHUB_CI_CD.md`.

## Roadmap (priorisation)

1. **Sprint 1 (fait / à maintenir)** : renforcer `src/routes/restaurants.js` et `src/routes/messages.js` via `tests/unit/routes/restaurants.routes.test.js` et `messages.routes.test.js` (liste, fallback, erreurs, CRUD admin, recherche, fil, POST idempotent).
2. **Sprint 2** : étendre `collectCoverageFrom` avec des routes à fort risque (`admin.js`, `upload.js`, `stream.js`, etc.) et ajouter au minimum happy path + erreurs pour chaque fichier ajouté.
3. **Sprint 3** : tests d’intégration API (Express + Mongo de test) pour les parcours les plus utilisés ; compléter Vitest côté hooks/services.

Les objectifs numériques de commentaires ou de JSDoc dans le code restent secondaires par rapport à des tests ciblés sur la logique métier et la sécurité.
