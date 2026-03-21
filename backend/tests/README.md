# Tests backend (Jest)

Guide transversal (Playwright, Vitest, charge) : **[docs/TESTING.md](../../docs/TESTING.md)**.

## Structure

| Chemin              | Rôle                                                           |
| ------------------- | -------------------------------------------------------------- |
| `tests/setup.js`    | Variables d’environnement (JWT, admin, rate-limit assoupli)    |
| `tests/fixtures/`   | Données réutilisables (users, restaurants, messages, feedback) |
| `tests/unit/`       | Suites unitaires / routes mockées                              |
| `src/**/__tests__/` | Tests historiques (middleware, routes, sécurité)               |

## Commandes

- `npm test` — couverture + `maxWorkers: 1` + `forceExit` (voir `jest.config.js`)
- `npm run test:watch`
- `npm run test:ci` — CI (`--ci`)

## Couverture

Le `collectCoverageFrom` cible les modules critiques : `auth`, `users`, `restaurants`, `messages`, `sync`, middlewares listés, modèles `User`, `Restaurant`, `Message`, `Feedback`.

**Objectif produit : 80 %** sur ce périmètre. Actuellement ~65 % statements, ~67 % lines. Le seuil **global** (~59–62 %) permet de progresser ; des seuils **par fichier** garantissent un minimum sur `errorHandler`, `validateInput`, `Feedback`, `Message`, `Restaurant`.

Fichiers faiblement couverts : `restaurants.js` (localisation, GET Mongo), `messages.js` (users/search, POST, agrégations avancées) — à compléter par des scénarios d’intégration.

## Notes

- Les tests qui mockent `User` doivent rester isolés ; `maxWorkers: 1` limite les interférences entre fichiers.
- Pour trouver les handles ouverts : `npx jest --detectOpenHandles`.
