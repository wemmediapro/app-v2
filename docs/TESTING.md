# Guide des tests

Ce document regroupe **comment** lancer et étendre les tests du dépôt. Le détail backend Jest reste dans [`backend/tests/README.md`](../backend/tests/README.md).

## Vue d’ensemble

| Couche                  | Outil                        | Emplacement                                                                                      |
| ----------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Backend API & libs      | Jest                         | `backend/tests/`, `backend/src/**/__tests__/`                                                    |
| Frontend (unitaire)     | Vitest                       | racine — `npm test` ; structure app : [ARCHITECTURE-PASSENGER.md](./ARCHITECTURE-PASSENGER.md)   |
| Parcours E2E            | Playwright                   | `tests/*.spec.js`, `playwright.config.js`                                                        |
| Charge HTTP / WebSocket | k6, Artillery                | `tests/load/`, voir [`tests/load/README.md`](../tests/load/README.md)                            |
| Micro-benchmarks CPU    | Vitest `bench`, scripts Node | `npm run test:bench` ; `cd backend && npm run bench` — voir [`PERFORMANCE.md`](./PERFORMANCE.md) |

## Prérequis

- Node.js **22+** (aligné CI)
- MongoDB pour les tests d’intégration qui toucent la base (sinon les routes mockent souvent les modèles)
- Variables d’environnement : le setup Jest charge `backend/tests/setup.js` (JWT, assouplissement rate-limit, etc.)

## Backend (Jest)

```bash
cd backend
npm test              # couverture + sortie CI-friendly
npm run test:watch    # boucle locale
npm run test:ci       # CI stricte
```

### Bonnes pratiques

- **Isolation** : mocker `mongoose` / modèles quand le test ne vise pas la persistance ; le projet utilise `maxWorkers: 1` pour limiter les interférences.
- **Handlers HTTP** : monter une mini-app `express()` avec `express.json()`, brancher le routeur sous test, appeler avec `supertest` (voir `backend/tests/unit/routes/`).
- **Logs d’erreur route** : spy sur `logger.error` et assert `event` / `err` comme décrit dans [`backend/tests/README.md`](../backend/tests/README.md) (section _Erreurs de route_).
- **Handles ouverts** : si Jest ne se termine pas, `npx jest --detectOpenHandles` (timers / rate-limit).

### Couverture

Les seuils et le périmètre `collectCoverageFrom` sont dans `backend/jest.config.js`. Objectif produit documenté dans `backend/tests/README.md` (~80 % sur le périmètre critique).

## Frontend (Vitest) & E2E (Playwright)

À la racine du repo :

```bash
npm install
npm test                 # Vitest (unitaires frontend)
npm run test:e2e         # Playwright
npx playwright install   # binaires navigateur (première fois)
```

Variantes : `npm run test:e2e:ui`, `test:e2e:headed`, `test:e2e:mobile` — voir `package.json` racine.

## Charge & performance

Les scénarios k6 / Artillery servent à valider la tenue sous charge, pas à remplacer les tests unitaires. Voir [PERFORMANCE.md](./PERFORMANCE.md) et `tests/load/README.md`.

**Benchmarks** : `npm run test:bench` (frontend, fichiers `*.bench.js` sous `src/tests/`) ; `npm run test:bench:backend` ou `cd backend && npm run bench` pour les scripts middleware / cache auth.

**Profiling** : CPU / heap V8 et Inspector — voir [PROFILING.md](./PROFILING.md) (`profile:backend:cpu`, `dev:inspect`, traces Playwright).

## CI

Le workflow GitHub Actions (`.github/workflows/tests.yml`) exécute en général les tests backend et les checks associés ; consulter le fichier pour la matrice Node et les étapes exactes.

## Exemples concrets dans le dépôt (copier / s’inspirer)

| Type                       | Fichiers                                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Route API + supertest**  | `auth.extended.test.js`, `messages.routes.test.js`, `restaurants.routes.test.js`, `critical.routes.test.js`, `admin.conversations.test.js`, `admin.routes-errors.test.js` (dans `backend/tests/unit/routes/`) |
| **Middleware**             | `backend/tests/unit/middleware/authMiddleware.flow.test.js`, `validateInput.unit.test.js`, `errorHandler.test.js`                                                                                             |
| **Sécurité / credentials** | `backend/tests/unit/routes/auth.security-credentials.test.js`, `backend/src/__tests__/security.test.js`                                                                                                       |
| **Fixtures**               | `backend/tests/fixtures/` (users, restaurants, messages, feedback) — voir [backend/tests/README.md](../backend/tests/README.md)                                                                               |
| **E2E Playwright**         | `tests/*.spec.js` (ex. `navigation.spec.js`, `critical-paths.spec.js`, `dashboard-auth.spec.js`, `magazine.spec.js`, `offline.spec.js`)                                                                       |
| **E2E dashboard + admin**  | Variables `PLAYWRIGHT_DASHBOARD_URL`, `PLAYWRIGHT_ADMIN_EMAIL`, `PLAYWRIGHT_ADMIN_PASSWORD` — voir en-tête de `tests/critical-paths.spec.js`                                                                  |
| **Charge**                 | `tests/load/gnv-1500-connections.js`, [tests/load/README.md](../tests/load/README.md)                                                                                                                         |

Pour ajouter un test : dupliquer une suite proche du module modifié, mocker Mongoose si la persistance n’est pas nécessaire, puis `cd backend && npm test -- --testPathPattern=nomDuFichier`.
