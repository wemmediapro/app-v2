# Quel middleware auth utiliser où

Le backend a **deux implémentations** d’auth (JWT) pour des périmètres différents. Ne pas les mélanger.

## 1. `backend/src/middleware/auth.js` — API principale (recommandé)

- **Utilisé par** : `backend/src/routes/*` (auth, admin, magazine, movies, shop, webtv, etc.), `server.js` (Socket.io `verifyToken`).
- **Secret** : `config.jwt.secret` (chargé depuis `config.env` / `.env`). **Aucun fallback** : si `JWT_SECRET` est absent, l’app refuse de démarrer.
- **Fonctions exportées** : `generateToken`, `generateAccessToken`, `verifyToken`, `getTokenFromRequest`, `authMiddleware`, `authenticateToken`, `adminMiddleware`, `optionalAuth`.
- **Token** : cookie `adminToken` (dashboard) ou header `Authorization: Bearer <token>`.

**À utiliser** pour toute nouvelle route sous `src/routes/` et pour le Socket.io.

---

## 2. `backend/middleware/auth.js` — Routes racine (legacy)

- **Utilisé par** : `backend/routes/*.js` (feedback, restaurants, radio, messaging, auth, admin, users, movies, shop, magazine) lorsque le serveur monte ces routes à la racine.
- **Secret** : `process.env.JWT_SECRET` directement (pas de config centralisée).
- **Fonctions exportées** : `authenticateToken`, `requireRole`, `optionalAuth`, `generateToken`.
- **Token** : header `Authorization: Bearer <token>` uniquement ; pas de cookie.

**À utiliser** uniquement pour les routes définies sous `backend/routes/` (fichiers à la racine de `backend/`).

---

## Récap

| Fichier de route              | Middleware auth à importer                          |
|------------------------------|-----------------------------------------------------|
| `backend/src/routes/*.js`    | `require('../middleware/auth')` → **src**           |
| `backend/routes/*.js`        | `require('../middleware/auth')` → **racine**        |
| Socket.io (server.js)        | `verifyToken` depuis **src/middleware/auth.js**     |

Consolider un jour vers un seul middleware (src) et migrer les routes racine vers src/routes est recommandé.
