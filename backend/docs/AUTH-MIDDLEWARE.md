# Auth middleware — implémentation unique

L’auth JWT est **centralisée** dans `backend/src/middleware/auth.js`.  
Toutes les routes API sont sous `backend/src/routes/` et utilisent ce middleware.

---

## `backend/src/middleware/auth.js`

- **Utilisé par** : `backend/src/routes/*`, `server.js` (Socket.io : `verifyToken` en decode-only).
- **Secret** : `config.jwt.secret` (config.env / .env). Pas de fallback.
- **Vérification** : JWT valide **puis** lookup MongoDB `User` (existence + `isActive`). `req.user` = document user (avec `id` pour compatibilité).
- **Fonctions** : `generateToken`, `generateAccessToken`, `verifyToken`, `getTokenFromRequest`, `authMiddleware`, `authenticateToken`, `adminMiddleware`, `requireRole`, `optionalAuth`.
- **Token** : cookie `adminToken` (dashboard) ou header `Authorization: Bearer <token>`.

**À utiliser** pour toute route sous `src/routes/`. Socket.io utilise uniquement `verifyToken` (sans DB lookup).

---

## Récap

| Fichier de route       | Importer                        | Comportement         |
| ---------------------- | ------------------------------- | -------------------- |
| `backend/src/routes/*` | `require('../middleware/auth')` | JWT + User lookup    |
| Socket.io (server.js)  | `verifyToken` depuis **src**    | Decode seul (pas DB) |
