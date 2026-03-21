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

## Erreurs de route (`logRouteError` / Pino)

Les handlers utilisent `logRouteError(req, 'nom_evenement_snake_case', err)`, qui appelle `logger.error({ event, err: message, stack })`. Dans les tests de routes :

- Ne pas mocker `console.error` pour ces cas : importer `const logger = require('../../../src/lib/logger')` et utiliser `jest.spyOn(logger, 'error').mockImplementation(() => {})`.
- Après l’appel HTTP attendu (souvent 500), vérifier l’événement et le message :  
  `expect(errSpy.mock.calls[0][0]).toEqual(expect.objectContaining({ event: '…', err: '…' }))`  
  en alignant `event` sur le premier argument de `logRouteError` dans la route testée.

`jest.config.js` active `restoreMocks: true` pour limiter les fuites de mocks Mongoose entre suites.

**Contexte optionnel** : `logRouteError(req, event, err, extra)` accepte un 4ᵉ objet `extra` fusionné dans la charge Pino (ex. `hasAdminEmail`, `email` sur `auth_login_admin_config_missing` / `auth_login_failed`). `logApiError` reste dans `logger.js` pour d’éventuels autres modules hors routes auth.

## Notes

- Les tests qui mockent `User` doivent rester isolés ; `maxWorkers: 1` limite les interférences entre fichiers.
- Pour trouver les handles ouverts : `npx jest --detectOpenHandles`.
