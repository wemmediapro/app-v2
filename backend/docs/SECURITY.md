# Sécurité — GNV OnBoard (backend)

Document de synthèse pour développeurs : contrôles en place et bonnes pratiques.

## Checklist audit (revue code)

| #   | Sujet                                                | Statut  | Détail                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Credentials en console (`init-database.js`, scripts) | ✅      | URI MongoDB : pas de log par défaut en CI ; avec `INIT_DB_VERBOSE=1` seulement, credentials masquées (`:***@`). Aucun mot de passe admin loggé.                                                                                 |
| 2   | Validation MongoID (`messages.js`, etc.)             | ✅      | `validateMongoId` sur `/:userId` ; agrégation utilise `req.user.id` (ObjectId côté auth). POST `/` : `body('receiver').isMongoId()` + express-validator.                                                                        |
| 3   | Autorisation rooms + XSS Socket.io                   | ✅      | `roomUtils.js` (rooms autorisées). `handlers.js` : `send-message` — contenu texte uniquement (rejette objets), DOMPurify sans balises, pièce jointe **chaîne** seulement ; tests `tests/unit/socket/handlers.sanitize.test.js`. |
| 4   | Validation body (messages, admin)                    | ✅ / ⚠️ | Messages POST : champs validés (receiver, content ≤ 1000, type, attachments). Routes admin : validators métier (`validation.js` + `validateInput.js`) selon endpoints — à étendre si nouvelles routes sensibles.                |
| 5   | Logs email (anti-énumération)                        | ✅      | `src/lib/logger.js` : `logFailedLogin` utilise `emailHash` (SHA-256 tronqué), pas d’email en clair.                                                                                                                             |
| 6   | Pagination / DoS                                     | ✅      | `validateInput.js` : `limit` plafonné à 100 ; `validation.js` : `validatePagination` idem.                                                                                                                                      |
| 7   | CSRF (timing)                                        | ✅      | Voir section [CSRF — comparaison constant-time](#csrf--comparaison-constant-time) ci-dessous.                                                                                                                                   |
| 8   | Tests sécurité                                       | ✅      | `src/__tests__/security.test.js`, `src/__tests__/roomUtils.test.js` (Socket rooms).                                                                                                                                             |
| 9   | Rate limit global API                                | ✅      | `server.js` : `app.use('/api/', apiLimiter)` avec store Redis en prod ; exclusions documentées (health, stream, admin JWT).                                                                                                     |
| 10  | Documentation                                        | ✅      | Ce fichier + `AUTH-MIDDLEWARE.md` ; lancer `npm run security:audit` dans `backend/`.                                                                                                                                            |
| 11  | Corrélation requête / erreurs                        | ✅      | `server.js` : en-tête **`X-Request-Id`** ; `req.log` (Pino) ; `globalErrorHandler` (`src/utils/errors.js`) ajoute **`requestId`** au JSON d’erreur ; tests `tests/unit/utils/errors.global-handler.test.js`.                    |

## CSRF — comparaison constant-time

Implémentation : **`src/middleware/csrf.js`**, fonction `csrfTokensEqual` :

- Les tokens (cookie `csrfToken` et header `X-CSRF-Token`) sont convertis en **`Buffer`** UTF-8.
- Comparaison avec **`crypto.timingSafeEqual(bufCookie, bufHeader)`** uniquement si les longueurs sont **identiques** (sinon pas de fuite sur la longueur attendue).
- Si les longueurs diffèrent : appel factice `crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32))` puis `return false` — le temps de réponse ne doit pas révéler la longueur du token valide.

Tests : `src/__tests__/security.test.js` (section CSRF).

## Scripts d’initialisation DB

- **`npm run init-db`** (`init-database.js`) : chemin **recommandé** (Mongoose, cohérent avec l’API).
- **`npm run init-db-prisma`** : script **legacy** — `ADMIN_EMAIL` **obligatoire** ; en production `ADMIN_PASSWORD` obligatoire ; en dev sans mot de passe, génération d’un mot de passe temporaire affiché une fois (`mustChangePassword` côté Prisma si le schéma l’expose). Voir [SECURITY.md](../../SECURITY.md) à la racine du dépôt.

## Guide validateurs (détail)

Voir **[VALIDATION.md](./VALIDATION.md)** — tableau des routes `messages` / `admin`, CSRF, bonnes pratiques.

## Guide déploiement (vue globale)

Voir **[docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md)** (checklist, liens vers PRODUCTION-GUIDE, Nginx, init DB).

## Commandes utiles

```bash
cd backend && npm test -- --testPathPattern="security|roomUtils|validation|auth.security-credentials|audit-logs"
cd backend && npm run security:audit
cd backend && npm run audit:security-credentials
```

## Audit logging

Toutes les actions admin (login, création/mise à jour/suppression d'utilisateurs) sont tracées dans la collection `auditlogs`. Rétention minimale : 1 an. Voir **[AUDIT-LOGGING-POLICY.md](../../docs/AUDIT-LOGGING-POLICY.md)**.

## Variables d’environnement sensibles

- Ne jamais committer `config.env` / `.env` avec secrets réels.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` obligatoires pour le login ; en prod, `ADMIN_EMAIL` ne peut pas être `admin@gnv.com` (`validateSecurityConfig` + login). Voir [SECURITY.md](../../SECURITY.md) à la racine.
- `JWT_SECRET` ≥ 32 caractères en production (`auth.js`).
- Redis obligatoire en production pour rate limit / Socket.io cluster.

## Socket.io — format des rooms

- **Chat 1-1** : `chat:<ObjectId_min>_<ObjectId_max>` (tri lexicographique), aligné avec `chatDmRoomName` / `useChat.js`.
- **Notifications perso** : `notifications:<userId>`.
- **Navire** : `ship:<shipId>` (doit correspondre au `shipId` du handshake).
