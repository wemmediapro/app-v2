# PR Draft : Correctifs sécurité CSRF, rate limit Redis, auth

## Résumé

- **CSRF** : comparaison par `crypto.timingSafeEqual()` dans un `try/catch` dans `backend/src/middleware/csrf.js` ; en cas d’exception → 403 `CSRF_INVALID`.
- **Rate limiters** : upload, stream, media-library, feedback et login/register passent sur un store **Redis** quand `REDIS_URI` ou `REDIS_URL` est configuré ; factory `createLimiter(store, options)` dans `rateLimitRedisStore.js` ; initialisation après DB/Redis ready dans `setupAfterDb()`.
- **optionalAuth** : si JWT non configuré (`getSecret()` lève), plus de 503 ; on fait `req.user = null` et `next()`.
- **Cache auth** : pour un utilisateur désactivé, on ne met plus en cache tout l’objet user mais un marqueur minimal `{ invalid: true, isActive: false }` dans `backend/src/middleware/auth.js`.
- **Tests** : tests unitaires pour CSRF (dont try/catch autour de `timingSafeEqual`) et pour optionalAuth (JWT non configuré → pas de 503, `req.user === null`).

## Instructions de test

1. **Tests unitaires**
   ```bash
   cd backend && npm test -- src/middleware/__tests__/auth.test.js src/__tests__/security.test.js
   ```
   Vérifier que tous les tests passent (dont optionalAuth et CSRF).

2. **CSRF**
   - Démarrer le backend, faire un GET sur une route API pour obtenir le cookie `csrfToken`, puis un POST avec le header `X-CSRF-Token` égal au token du cookie → 200.
   - POST sans token ou avec token incorrect → 403 avec `code: 'CSRF_INVALID'`.

3. **optionalAuth (JWT non configuré)**
   - Désactiver temporairement `JWT_SECRET` (ex. retirer de `.env`), redémarrer, appeler une route protégée par `optionalAuth` : la requête doit continuer avec `req.user = null` (pas de 503).

4. **Rate limiters Redis**
   - Avec `REDIS_URI` ou `REDIS_URL` défini et Redis démarré : démarrer le backend, vérifier les logs du type « Rate limit API : store Redis actif » et que les routes upload/stream/media-library/feedback/login sont limitées (ex. 429 après dépassement).
   - Sans Redis : les limiters restent en mémoire (comportement inchangé).

5. **Cache utilisateur désactivé**
   - Désactiver un utilisateur en base (`isActive: false`), appeler une route protégée avec son token : 401 `ACCOUNT_DEACTIVATED` ; en Redis le cache pour cette clé doit contenir uniquement `{ invalid: true, isActive: false }` (pas tout l’objet user).

## Branche

- `fix/security-csrf-rate-limit-auth-cache`

## Remarques

- Les dépendances `rate-limit-redis` et `redis` étaient déjà présentes ; le store utilisé reste le store Redis custom (`rateLimitRedisStore.js`) avec `sendCommand` pour le TTL.
- Créer la PR en **draft** sur le dépôt cible (ex. `wemmediapro/app-v2`), puis marquer « Ready for review » après validation des tests manuels.
