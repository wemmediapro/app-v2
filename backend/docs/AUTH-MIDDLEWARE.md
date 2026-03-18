# Auth middleware — une seule implémentation

L’auth JWT est **centralisée** dans `backend/src/middleware/auth.js`.  
`backend/middleware/auth.js` est un **wrapper de compatibilité** pour `backend/routes/*` (s’ils sont montés).

---

## 1. `backend/src/middleware/auth.js` — Implémentation unique

- **Utilisé par** : `backend/src/routes/*`, `server.js` (Socket.io : `verifyToken` en decode-only).
- **Secret** : `config.jwt.secret` (config.env / .env). Pas de fallback.
- **Vérification** : JWT valide **puis** lookup MongoDB `User` (existence + `isActive`). `req.user` = document user (avec `id` pour compatibilité).
- **Fonctions** : `generateToken`, `generateAccessToken`, `verifyToken`, `getTokenFromRequest`, `authMiddleware`, `authenticateToken`, `adminMiddleware`, `requireRole`, `optionalAuth`.
- **Token** : cookie `adminToken` (dashboard) ou header `Authorization: Bearer <token>`.

**À utiliser** pour toute route sous `src/routes/`. Socket.io utilise uniquement `verifyToken` (sans DB lookup).

---

## 2. `backend/middleware/auth.js` — Wrapper (compatibilité)

- **Rôle** : réexporte l’auth src pour `backend/routes/*.js` sans dupliquer la logique.
- **API** : `authenticateToken`, `requireRole`, `optionalAuth`, `generateToken(userId)` (converti en `generateToken({ id, userId })` vers src).

Si tu montes des routes sous `backend/routes/`, elles utilisent donc la **même** logique (JWT + User lookup) que `src/routes/`.

---

## Récap

| Fichier de route       | Importer                          | Comportement        |
|------------------------|-----------------------------------|---------------------|
| `backend/src/routes/*` | `require('../middleware/auth')`   | JWT + User lookup   |
| `backend/routes/*`     | `require('../middleware/auth')`   | Idem (via wrapper)  |
| Socket.io (server.js)  | `verifyToken` depuis **src**      | Decode seul (pas DB)|
