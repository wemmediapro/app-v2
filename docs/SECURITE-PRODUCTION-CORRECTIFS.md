# GNV OnBoard — Correctifs sécurité, performance et fiabilité (production)

Document de référence pour chaque problème identifié : code avant/après, fichier, explication, test et documentation.

---

## 1. SÉCURITÉ CRITIQUE

### [PRIORITÉ] PROBLÈME #1 : Identifiants par défaut publics (admin@gnv.com / admin123)

**Fichiers** : `backend/src/routes/auth.js` (l.94-96), `backend/scripts/init-database.js` (l.52-62), `backend/scripts/seed-admin.js` (l.19-24), `dashboard/src/pages/Login.jsx` (l.84, 137-141), `setup.sh`, `ansible/group_vars/all.yml`, etc.

**Sévérité** : 🔴 Critique

**LE PROBLÈME:**

```javascript
// backend/src/routes/auth.js — fallback email/mot de passe en clair
const effectiveAdminEmail = adminEmail || 'admin@gnv.com';
const effectiveAdminPassword = isProduction ? adminPassword : (adminPassword || 'Admin123!');

// backend/scripts/init-database.js — mot de passe par défaut
password: process.env.ADMIN_PASSWORD || 'admin123',

// dashboard Login.jsx — placeholder et encadré "Identifiants de démonstration"
placeholder="admin@gnv.com"
<p><strong>Email :</strong> admin@gnv.com</p>
<p><strong>Mot de passe :</strong> Admin123!</p>
```

**LA SOLUTION:**

- En production : ne jamais utiliser de fallback ; exiger `ADMIN_EMAIL` et `ADMIN_PASSWORD` (déjà partiellement fait).
- En dev : utiliser uniquement des variables d’environnement (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) ; pas de chaîne en dur.
- Scripts seed/init : refuser de créer un admin si `ADMIN_PASSWORD` n’est pas défini en production ; en dev, afficher un message invitant à définir `ADMIN_PASSWORD` et à ne pas commiter de valeurs par défaut.
- Dashboard : supprimer l’encadré « Identifiants de démonstration » en production (ou le masquer si `NODE_ENV === 'production'`) ; placeholder email neutre (« votre@email.com »).

**POURQUOI C'EST IMPORTANT:**

- Risque : prise de contrôle du dashboard et des données (OWASP A07:2021 – Identification and Authentication Failures).
- Impact : accès admin complet, modification/suppression de contenus, fuite de données.

**COMMENT TESTER:**

```bash
# Vérifier qu’en production aucun fallback n’est utilisé
NODE_ENV=production node -e "
  process.env.ADMIN_PASSWORD = '';
  const config = require('./backend/src/config');
  // Le serveur doit refuser le démarrage si ADMIN_PASSWORD manque (voir server.js)
"
```

**DOCUMENTATION:**

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

### [PRIORITÉ] PROBLÈME #2 : JWT_SECRET peut être faible

**Fichier** : `backend/server.js` (l.10-14), `backend/src/config/index.js` (l.22-26), `backend/src/middleware/auth.js` (l.5-11)

**Sévérité** : 🔴 Critique

**LE PROBLÈME:**

```javascript
// server.js — vérifie seulement la présence, pas la force
if (!config.jwt.secret) {
  console.error('CRITICAL: JWT_SECRET must be set in production.');
  process.exit(1);
}

// config — fallback dev faible
secret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'dev-secret-change-in-production'),
```

**LA SOLUTION:**

- Au démarrage (production et dev) : exiger `JWT_SECRET` d’au moins 32 caractères (recommandation OWASP / RFC).
- Refuser le démarrage si `JWT_SECRET.length < 32` en production ; en dev, afficher un avertissement si secret absent ou court.

```javascript
// backend/src/config/index.js
const rawSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'dev-secret-change-in-production');
const JWT_MIN_LENGTH = 32;
if (process.env.NODE_ENV === 'production') {
  if (!rawSecret || typeof rawSecret !== 'string' || rawSecret.length < JWT_MIN_LENGTH) {
    console.error(`CRITICAL: JWT_SECRET must be set and at least ${JWT_MIN_LENGTH} characters in production.`);
    process.exit(1);
  }
} else if (rawSecret && rawSecret.length < JWT_MIN_LENGTH) {
  console.warn(`WARN: JWT_SECRET is shorter than ${JWT_MIN_LENGTH} characters. Use a longer secret in production.`);
}
jwt: {
  secret: rawSecret,
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
},
```

**POURQUOI C'EST IMPORTANT:**

- Risque : brute-force du secret et fabrication de tokens (OWASP A02:2021 – Cryptographic Failures).
- Impact : usurpation d’identité, accès admin.

**COMMENT TESTER:**

```bash
# Générer un secret fort
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Vérifier refus au démarrage avec JWT_SECRET=short
JWT_SECRET=short NODE_ENV=production node backend/server.js  # doit exit 1
```

**DOCUMENTATION:**

- [RFC 8725 – JWT Security](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Key Management](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)

---

### [PRIORITÉ] PROBLÈME #3 : Socket.io sans autorisation sur les rooms privées

**Fichier** : `backend/server.js` (l.318-324, 322-326)

**Sévérité** : 🔴 Critique

**LE PROBLÈME:**

```javascript
socket.on('join-room', (room) => {
  if (typeof room !== 'string' || room.length > 64) return;
  socket.join(room); // Aucune vérification que l’utilisateur a le droit d’accéder à cette room
});

socket.on('send-message', (data) => {
  if (!data || typeof data.room !== 'string' || data.room.length > 64) return;
  socket.to(data.room).emit('new-message', data); // Pas de vérification d’appartenance à la room
});
```

**LA SOLUTION:**

- Définir une liste de préfixes de rooms autorisées (ex. `ship:`, `notifications:`, `chat:`) et un format strict (ex. `ship:<shipId>`, `chat:<conversationId>`).
- Avant `socket.join(room)` : valider le format et vérifier (si besoin en base) que l’utilisateur a le droit d’accéder à cette room (ex. conversation dont il est membre).
- Avant d’émettre `new-message` : vérifier que le socket est dans la room (`socket.rooms.has(data.room)`).
- Sanitiser le payload des messages (voir PROBLÈME #19 – XSS).

```javascript
const ALLOWED_ROOM_PREFIXES = ['ship:', 'notifications:', 'chat:'];
function isRoomAllowed(room) {
  if (typeof room !== 'string' || room.length > 64) return false;
  return ALLOWED_ROOM_PREFIXES.some((prefix) => room.startsWith(prefix));
}

socket.on('join-room', (room, cb) => {
  if (!isRoomAllowed(room)) return cb?.(new Error('Invalid room'));
  // Optionnel : vérifier en base que user peut rejoindre cette room
  socket.join(room);
  cb?.();
});

socket.on('send-message', (data, cb) => {
  if (!data || !isRoomAllowed(data.room)) return cb?.(new Error('Invalid room'));
  if (!socket.rooms.has(data.room)) return cb?.(new Error('Not in room'));
  const sanitized = sanitizeMessagePayload(data);
  socket.to(data.room).emit('new-message', sanitized);
  cb?.();
});
```

**POURQUOI C'EST IMPORTANT:**

- Risque : écoute de rooms privées, envoi de messages dans des rooms non autorisées (OWASP A01:2021 – Broken Access Control).
- Impact : fuite de conversations, usurpation de messages.

**COMMENT TESTER:**

- Test manuel : tenter `join-room` avec une room non autorisée → doit être rejeté.
- Test unitaire : vérifier que `send-message` sans avoir rejoint la room échoue.

**DOCUMENTATION:**

- [Socket.io – Middleware](https://socket.io/docs/v4/middlewares/)
- [Socket.io – Rooms](https://socket.io/docs/v4/rooms/)

---

### [PRIORITÉ] PROBLÈME #4 : Pas de validation input globale

**Fichiers** : `backend/src/routes/*.js` (plusieurs routes sans `express-validator`)

**Sévérité** : 🟠 Majeur

**LE PROBLÈME:**

- Certaines routes utilisent `express-validator` (auth, magazine, shop, feedback, etc.) ; d’autres acceptent `req.body` / `req.query` sans validation (ex. `req.params.id` sans vérification ObjectId, `req.query.limit` non plafonné).

**LA SOLUTION:**

- Appliquer un middleware global pour les paramètres communs : `query.page`, `query.limit` (déjà `validatePagination` dans `validation.js`).
- Monter `validatePagination` sur les routes listes (movies, magazine, shop, notifications, users, feedback, etc.).
- Pour chaque route qui accepte un `id` MongoDB : valider avec `param('id').isMongoId()`.
- Exposer un helper `validateMongoId(paramName)` et l’utiliser sur les routes :id.

```javascript
// backend/src/middleware/validation.js — ajout
const { param } = require('express-validator');
const validateMongoId = (name = 'id') => [param(name).isMongoId().withMessage('Invalid ID')];

// Dans chaque route liste
router.get('/', validatePagination, async (req, res) => { ... });
router.get('/:id', validateMongoId('id'), handleValidationErrors, async (req, res) => { ... });
```

**POURQUOI C'EST IMPORTANT:**

- Risque : injection NoSQL, DoS par requêtes malformées, données incohérentes (OWASP A03:2021 – Injection).
- Impact : corruption de données, erreurs 500, fuite d’informations.

**COMMENT TESTER:**

```bash
# Requête avec limit énorme
curl "http://localhost:3000/api/movies?limit=999999"  # doit être plafonné à 100
# ID invalide
curl "http://localhost:3000/api/movies/not-an-id"     # 400 Invalid ID
```

**DOCUMENTATION:**

- [express-validator](https://express-validator.github.io/docs/)
- [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)

---

### [PRIORITÉ] PROBLÈME #5 : Pas de CSRF protection

**Fichier** : `backend/server.js`, routes POST/PUT/DELETE

**Sévérité** : 🟠 Majeur

**LE PROBLÈME:**

- L’API utilise des cookies (`adminToken`) pour le dashboard ; sans jeton CSRF, un site tiers peut déclencher des requêtes authentifiées depuis le navigateur de la victime.

**LA SOLUTION:**

- Utiliser le double submit cookie : le front envoie un header `X-CSRF-Token` (ou `Csrf-Token`) dont la valeur est un token stocké en cookie (ex. `csrfToken`) et vérifié côté backend.
- Alternative pour API + SPA : `SameSite=Strict` (ou `Lax`) sur le cookie de session (déjà en production) réduit le risque ; pour les formulaires sensibles (changement mot de passe, suppression), exiger un header CSRF.
- Lib recommandée : `csurf` (déprécié en faveur de implémentations manuelles) ou implémentation custom avec `crypto.randomBytes(32).toString('hex')` en cookie + vérification du header.

**Contrainte** : vous avez demandé d’utiliser les libs déjà dans `package.json`. `csurf` n’y est pas ; on peut soit l’ajouter (`npm i csurf`), soit implémenter un double-submit cookie manuellement (cookie + header). Justification d’une nouvelle dépendance : `csurf` est la référence pour Express ; sans elle, implémentation manuelle nécessaire.

```javascript
// Option manuelle (sans nouvelle lib)
const csrfToken = require('crypto').randomBytes(32).toString('hex');
res.cookie('csrfToken', csrfToken, { httpOnly: false, sameSite: 'strict', secure: true });
// Sur les mutations : vérifier req.headers['x-csrf-token'] === req.cookies.csrfToken
```

**POURQUOI C'EST IMPORTANT:**

- Risque : attaque CSRF sur actions sensibles (OWASP A01:2021 – Broken Access Control).
- Impact : actions effectuées au nom de l’admin sans son consentement.

**COMMENT TESTER:**

- Depuis un autre domaine, tenter un POST avec le cookie de session : sans le bon header CSRF, la requête doit être rejetée (401/403).

**DOCUMENTATION:**

- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)

---

### [PRIORITÉ] PROBLÈME #6 : Secrets exposés en logs

**Fichiers** : `backend/src/lib/logger.js`, tous les `console.log/error` qui pourraient logger `req.body`, `err` contenant des secrets

**Sévérité** : 🔴 Critique

**LE PROBLÈME:**

```javascript
console.error('Login error:', error); // error peut contenir des infos sensibles
logger.error({ err: err.message, stack: err.stack, path: req?.path }); // stack peut contenir des variables
```

**LA SOLUTION:**

- Ne jamais logger `req.body` en entier (mot de passe, token).
- Utiliser un masque pour les champs sensibles : `password`, `token`, `authorization`, `cookie`, `csrfToken`, `JWT_SECRET`, etc. (remplacer par `***` ou `[REDACTED]`).
- Dans le logger (pino) : sérialiser les objets en filtrant les clés sensibles avant de les passer au logger.

```javascript
const SENSITIVE_KEYS = /password|token|secret|authorization|cookie|csrf|jwt/i;
function redact(obj) {
  if (obj == null) return obj;
  if (typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.test(k)) out[k] = '[REDACTED]';
    else out[k] = typeof v === 'object' && v !== null && !Array.isArray(v) ? redact(v) : v;
  }
  return out;
}
logger.error({ err: err.message, path: req?.path, body: redact(req?.body) });
```

**POURQUOI C'EST IMPORTANT:**

- Risque : fuite de secrets dans les fichiers de log ou outils de monitoring (OWASP A09:2021 – Security Logging and Monitoring Failures).
- Impact : compromission des comptes si les logs sont exposés.

**COMMENT TESTER:**

- Envoyer une requête de login avec un mot de passe de test ; vérifier que les logs ne contiennent pas le mot de passe en clair.

**DOCUMENTATION:**

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [pino – serializers](https://github.com/pinojs/pino/blob/main/docs/api.md#serializers-object)

---

## 2. PERFORMANCE & SCALABILITÉ

### PROBLÈME #7 : Pagination sur les listes (limit 20 par défaut)

**Fichiers** : `backend/src/routes/users.js`, `backend/src/routes/notifications.js`, `backend/src/routes/admin.js`, `backend/src/routes/feedback.js`, etc.

**Sévérité** : 🟠 Majeur

**LE PROBLÈME:**

```javascript
// users.js — pas de pagination
const users = await User.find(query).sort({ createdAt: -1 });
// notifications.js — find() sans limit
const notifications = await Notification.find().sort({ createdAt: -1 });
```

**LA SOLUTION:**

- Utiliser `validatePagination` (déjà défini dans `validation.js`) sur toutes les routes qui renvoient des listes.
- Appliquer `.skip(skip).limit(limit)` avec `limit` par défaut 20 et max 100.
- Renvoyer `{ data, total, page, limit }` pour que le client puisse paginer.

**POURQUOI C'EST IMPORTANT:**

- Risque : charge mémoire et temps de réponse élevés avec 1000+ utilisateurs.
- Impact : lenteur, timeouts, mauvaise expérience.

**DOCUMENTATION:**

- [MongoDB – skip / limit](https://www.mongodb.com/docs/manual/reference/method/cursor.skip/)

---

### PROBLÈME #8 : Rate limiting fragile en cluster → Redis store

**Fichier** : `backend/server.js` (l.199-226), `backend/src/lib/rateLimitRedisStore.js`

**Sévérité** : 🟠 Majeur

**LE PROBLÈME:**

- En cluster, chaque worker a son propre store mémoire ; la limite est par worker, pas globale. Un attaquant peut dépasser la limite en répartissant les requêtes sur les workers.

**LA SOLUTION:**

- Déjà en place : `createRedisStore` et passage du store à `apiLimiter`. S’assurer que `REDIS_URI` est défini en production et que le store est bien utilisé (logs « Rate limit API : store Redis actif »).
- Les limiters montés avant `setupAfterDb()` (upload, stream, media-library) n’utilisent pas Redis ; pour une cohérence totale, on peut les laisser en mémoire (par worker) car ils sont déjà restrictifs, ou les faire passer par le même Redis store une fois initialisé (refactor possible).

**POURQUOI C'EST IMPORTANT:**

- En cluster, sans Redis le rate limit est contournable.
- Impact : abus, DoS, épuisement des ressources.

**DOCUMENTATION:**

- [express-rate-limit – Store](https://github.com/express-rate-limit/express-rate-limit#store)
- [Creating a Store (express-rate-limit)](https://express-rate-limit.mintlify.app/guides/creating-a-store)

---

### PROBLÈME #9 : PWA cache 14j → 7j + stale-while-revalidate

**Fichier** : `vite.config.js` (l.63-72)

**Sévérité** : 🟡 Mineur

**LE PROBLÈME:**

```javascript
expiration: { maxEntries: 180, maxAgeSeconds: 14 * 24 * 60 * 60 },  // 14 jours
```

**LA SOLUTION:**

```javascript
expiration: { maxEntries: 180, maxAgeSeconds: 7 * 24 * 60 * 60 },  // 7 jours
// Pour NetworkFirst / CacheFirst, Workbox gère stale-while-revalidate si configuré
// Ex. pour API cache : networkTimeoutSeconds + expiration avec maxAgeSeconds 7*24*3600
```

**POURQUOI C'EST IMPORTANT:**

- Réduire la durée pendant laquelle du contenu obsolète est servi hors ligne.
- Améliorer la fraîcheur perçue sans sacrifier trop le cache.

**DOCUMENTATION:**

- [Workbox – ExpirationPlugin](https://developer.chrome.com/docs/workbox/reference/workbox-expiration/)

---

### PROBLÈME #10 : Monitoring logs → Pino logger

**Fichier** : `backend/src/lib/logger.js`, `backend/server.js`

**Sévérité** : 🟡 Mineur

**LE PROBLÈME:**

- Mélange de `console.log` et de `logger` (pino) ; pas de structure commune pour le monitoring (corrélation, niveaux, champs standards).

**LA SOLUTION:**

- Utiliser pino partout à la place de `console` dans le code serveur.
- Ajouter des champs structurés : `reqId`, `userId`, `path`, `duration`, `level`.
- Redirection de pino vers stdout en JSON pour ingestion (Datadog, ELK, etc.).

**POURQUOI C'EST IMPORTANT:**

- Logs structurés = requêtes, alertes et analyse plus simples en production.

**DOCUMENTATION:**

- [pino – documentation](https://getpino.io/#/)

---

## 3. FIABILITÉ

### PROBLÈME #11 : Gestion d’erreurs incohérente → Classe AppError

**Fichiers** : routes et middleware d’erreur

**Sévérité** : 🟠 Majeur

**LE PROBLÈME:**

- Erreurs renvoyées avec `res.status(500).json({ message: err.message })` ou `res.status(400).json(...)` de façon ad hoc ; pas de code d’erreur standard, pas de traçabilité.

**LA SOLUTION:**

- Créer une classe `AppError` (ex. `backend/src/lib/AppError.js`) avec `statusCode`, `code`, `message`, `isOperational`.
- Middleware d’erreur global : si `err instanceof AppError`, utiliser `err.statusCode` et `err.code` ; sinon 500 et masquer le détail en production.
- Dans les routes : `next(new AppError('Invalid ID', 400, 'INVALID_ID'))`.

**POURQUOI C'EST IMPORTANT:**

- Réponses d’erreur cohérentes, codes métier pour le front, pas de fuite de stack en production.

**DOCUMENTATION:**

- [Express – Error handling](https://expressjs.com/en/guide/error-handling.html)

---

### PROBLÈME #12 : Pas de transactions MongoDB

**Fichiers** : routes qui font plusieurs écritures (ex. création user + rôle, mise à jour liée)

**Sévérité** : 🟠 Majeur

**LA SOLUTION:**

- Pour les opérations multi-documents qui doivent être atomiques : utiliser `mongoose.startSession()`, `session.startTransaction()`, `session.commitTransaction()` / `session.abortTransaction()`.
- Exemple : création d’un message + mise à jour du dernier message de la conversation dans une même transaction.

**DOCUMENTATION:**

- [MongoDB – Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [Mongoose – Transactions](https://mongoosejs.com/docs/transactions.html)

---

### PROBLÈME #13 : Retry logic → Exponential backoff

**Fichiers** : `backend/src/lib/database.js`, connexions Redis, appels HTTP externes

**Sévérité** : 🟡 Mineur

**LA SOLUTION:**

- Pour MongoDB : réessais avec délai croissant (déjà partiellement présent dans la config `reconnectMaxRetries`, `reconnectDelayMs`).
- Pour Redis et appels HTTP (ex. OpenAI, Google) : wrapper les appels dans une fonction `withRetry(fn, { maxRetries: 3, baseDelayMs: 1000 })` avec backoff exponentiel.

**DOCUMENTATION:**

- [Exponential backoff](https://en.wikipedia.org/wiki/Exponential_backoff)

---

### PROBLÈME #14 : Socket.io reconnection logic

**Fichier** : frontend (connexion Socket.io client)

**Sévérité** : 🟡 Mineur

**LE PROBLÈME:**

- Le client Socket.io a une reconnexion par défaut ; s’assurer que le token est bien renvoyé après reconnexion (`auth: { token }`) et que les rooms sont rejointes après `connect`.

**LA SOLUTION:**

- Côté client : sur `io.on('connect')`, renvoyer les rooms à rejoindre et rafraîchir le token si nécessaire.
- Côté serveur : le middleware d’auth Socket.io s’exécute à chaque reconnexion ; pas de changement majeur si le token est fourni dans `auth`.

**DOCUMENTATION:**

- [Socket.io client – reconnection](https://socket.io/docs/v4/client-options/#reconnection)

---

## 4. VALIDATION & SANITIZATION

### PROBLÈME #15 : Input validation manquante

- Voir PROBLÈME #4 (validation globale). S’assurer que tous les inputs (body, query, params) sont validés et plafonnés.

### PROBLÈME #16 : NoSQL injection possible

**Sévérité** : 🔴 Critique

**LE PROBLÈME:**

- Passage direct de `req.query` ou `req.body` dans `Model.find(req.body)` ou dans des filtres dynamiques sans sanitization.

**LA SOLUTION:**

- Ne jamais construire des filtres à partir de champs arbitraires. Utiliser des champs autorisés en liste blanche.
- Pour les ObjectId : toujours valider avec `mongoose.Types.ObjectId.isValid(id)` ou express-validator `isMongoId()`.
- Pour les recherches texte : utiliser `safeRegexSearch` (déjà présent dans magazine) ou échapper les caractères spéciaux regex.

**DOCUMENTATION:**

- [OWASP NoSQL Injection](https://cheatsheetseries.owasp.org/cheatsheets/NoSQL_Injection_Prevention_Cheat_Sheet.html)

---

### PROBLÈME #17 : XXE / Prototype pollution → Helmet avancé

**Fichier** : `backend/server.js` (helmet)

**Sévérité** : 🟠 Majeur

**LE PROBLÈME:**

- Helmet est utilisé avec des options de base ; pas de protection explicite contre la prototype pollution (JSON) ni contre des payloads XML malveillants si l’API accepte du XML.

**LA SOLUTION:**

- Si l’API ne traite que du JSON : éviter d’utiliser `bodyParser` avec `type: 'application/xml'` ; garder `express.json()` avec `limit` raisonnable.
- Pour la prototype pollution : utiliser un middleware qui nettoie `__proto__` et `constructor.prototype` des objets entrants, ou une lib comme `mongoose-sanitize` / validation stricte des schémas.
- Helmet : activer toutes les options recommandées (déjà contentSecurityPolicy, crossOriginResourcePolicy) ; pas de changement majeur si pas d’XML.

**DOCUMENTATION:**

- [Helmet – documentation](https://helmetjs.github.io/)
- [Prototype pollution](https://portswigger.net/web-security/prototype-pollution)

---

### PROBLÈME #18 : XSS sur Socket.io messages → DOMPurify

**Fichiers** : Backend (émission des messages), frontend (affichage)

**Sévérité** : 🔴 Critique

**LE PROBLÈME:**

- Les messages envoyés via `send-message` sont renvoyés tels quels aux clients ; si le client les affiche en HTML sans échappement, risque XSS.

**LA SOLUTION:**

- Côté backend : sanitiser le payload (champs texte) avant d’émettre. En Node, on peut utiliser `dompurify` avec un build « jsdom » (DOMPurify peut tourner en Node avec jsdom) ou une sanitization manuelle (strip tags, limiter longueur).
- Côté frontend : toujours afficher le texte avec échappement (React échappe par défaut ; éviter `dangerouslySetInnerHTML` avec le contenu des messages).
- Si vous utilisez déjà `dompurify` dans le frontend (présent dans `package.json` racine), côté backend on peut ajouter `dompurify` + `jsdom` pour la même sanitization, ou une lib légère comme `sanitize-html` / `xss` pour le backend.

**Contrainte** : libs déjà dans package.json. Le front a `dompurify` ; le backend n’a pas `jsdom`. Option : ajouter `sanitize-html` ou `xss` au backend pour sanitiser les champs texte des messages (justification : prévention XSS sur contenu temps réel).

```javascript
// Backend — exemple avec sanitize-html (à ajouter en dépendance) ou strip des balises
const sanitize = (str) => (typeof str === 'string' ? str.replace(/<[^>]*>/g, '').slice(0, 2000) : '');
socket.on('send-message', (data, cb) => {
  const sanitized = { ...data, text: sanitize(data.text), room: sanitize(data.room) };
  socket.to(data.room).emit('new-message', sanitized);
});
```

**POURQUOI C'EST IMPORTANT:**

- Risque : XSS stocké/refleté via les messages (OWASP A03:2021 – Injection).
- Impact : vol de session, modification de contenu affiché.

**DOCUMENTATION:**

- [DOMPurify](https://github.com/cure53/DOMPurify)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

---

## Récapitulatif des fichiers à modifier (priorité haute)

| #   | Fichier                                | Modification                                                                 |
| --- | -------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | `backend/src/routes/auth.js`           | Supprimer fallback admin@gnv.com / Admin123! en dev ; exiger env             |
| 2   | `backend/scripts/init-database.js`     | Pas de mot de passe par défaut ; exiger ADMIN_PASSWORD en prod               |
| 3   | `backend/scripts/seed-admin.js`        | Lire email/mot de passe depuis env uniquement                                |
| 4   | `dashboard/src/pages/Login.jsx`        | Placeholder neutre ; masquer encadré démo en prod                            |
| 5   | `backend/src/config/index.js`          | Validation JWT_SECRET ≥ 32 caractères                                        |
| 6   | `backend/server.js`                    | Vérification JWT_SECRET length au démarrage ; Socket.io room auth + sanitize |
| 7   | `backend/src/lib/logger.js`            | Redaction des champs sensibles                                               |
| 8   | `vite.config.js`                       | PWA cache 7j, stale-while-revalidate si applicable                           |
| 9   | `backend/src/middleware/validation.js` | validateMongoId ; export pour usage global                                   |
| 10  | Routes (users, notifications, etc.)    | validatePagination + validateMongoId où pertinent                            |

---

## BONUS : Checklist déploiement production

- [ ] `JWT_SECRET` défini et ≥ 32 caractères
- [ ] `ADMIN_EMAIL` et `ADMIN_PASSWORD` définis (aucun fallback)
- [ ] `REDIS_URI` défini (rate limit + Socket.io adapter)
- [ ] `MONGODB_URI` sécurisé (réseau, auth)
- [ ] Aucun identifiant de démo affiché sur le dashboard (prod)
- [ ] Logs sans secrets (redaction)
- [ ] Helmet + CSP configurés
- [ ] Rate limit API avec store Redis
- [ ] Socket.io : auth JWT + validation des rooms
- [ ] Validation des inputs (express-validator) sur toutes les routes sensibles
- [ ] PWA cache 7j
- [ ] Tests de sécurité (login, rate limit, IDs invalides) exécutés avant mise en prod
