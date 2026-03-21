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

### Production — 2FA obligatoire pour les comptes `admin`

`adminMiddleware` refuse toute route protégée par ce middleware si `NODE_ENV=production`, que l’utilisateur est `role: admin`, que `twoFactorEnabled` est faux, et que le chemin n’est pas un onboarding 2FA : `POST .../auth/2fa/setup`, `POST .../auth/2fa/verify`, `GET .../auth/me`, `POST .../auth/logout`, **`POST .../auth/register`** (création d’utilisateurs avant 2FA). Réponse : **403** avec `code: ADMIN_2FA_SETUP_REQUIRED`. Variable d’urgence (déconseillée) : `ADMIN_2FA_OPTIONAL=1`.

---

## Récap

| Fichier de route       | Importer                        | Comportement         |
| ---------------------- | ------------------------------- | -------------------- |
| `backend/src/routes/*` | `require('../middleware/auth')` | JWT + User lookup    |
| Socket.io (server.js)  | `verifyToken` depuis **src**    | Decode seul (pas DB) |
