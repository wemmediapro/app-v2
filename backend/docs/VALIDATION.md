# Guide des validateurs — API backend GNV

Ce document décrit **où** et **comment** les entrées sont validées (Express + `express-validator` + helpers `validateInput.js`).

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `src/middleware/validateInput.js` | `validateMongoId`, pagination (`createValidatePagination`), `sanitizeSearchString`, `handleValidationErrors` |
| `src/middleware/validation.js` | Chaînes réutilisables : `registerValidation`, `loginValidation`, `profileValidation`, `adminUserUpdateValidation`, `settingsAccessValidation`, etc. |

## Routes `messages` (`src/routes/messages.js`)

| Méthode | Chemin | Validation |
|---------|--------|------------|
| GET | `/` | `validatePagination` + `handleValidationErrors` |
| GET | `/users/search` | `query('q').optional().isString().isLength({ max: 200 })` + `handleValidationErrors` |
| GET | `/:userId` | `validateMongoId('userId')`, `validateMessagesPagination` |
| POST | `/` | `body('receiver').isMongoId()`, `content`, `type`, `attachments` + `handleValidationErrors` |

**Note :** il n’y a pas de PUT/DELETE sur la ressource message dans ce router ; seul POST envoie un corps JSON validé.

## Routes `admin` (`src/routes/admin.js`)

| Méthode | Chemin | Validation |
|---------|--------|------------|
| POST | `/users` | `registerValidation` (prénom, nom, email, mot de passe, téléphone) |
| PUT | `/users/:id` | `validateMongoId('id')` puis `adminUserUpdateValidation` (champs optionnels typés) |
| DELETE | `/users/:id` | `validateMongoId('id')` + `adminDeleteUserQueryValidation` (`?hard=` true/false/1/0) |
| PUT | `/settings/access` | `settingsAccessValidation` (`admin`, `crew`, `passenger` objets optionnels) |
| POST | `/cache/clear` | Pas de corps attendu (action sans payload) |

Les GET utilisent en général `validatePagination` / `validateMongoId` selon les routes.

## CSRF (`src/middleware/csrf.js`)

- Comparaison **constant-time** : `crypto.timingSafeEqual` sur les buffers UTF-8 des tokens.
- Si les longueurs diffèrent : appel factice à `timingSafeEqual` sur deux buffers de 32 octets pour éviter une fuite par timing sur la longueur.

Voir les tests : `src/__tests__/security.test.js` (section CSRF).

## Ajouter une validation sur une nouvelle route

1. Préférer des **chaînes** `express-validator` dans `validation.js` si la règle est réutilisée.
2. Monter la chaîne **avant** le handler : `[..., handleValidationErrors]` ou spread `...myValidation` si le tableau se termine par `handleValidationErrors` dans `validation.js`.
3. Pour les IDs dans l’URL : `validateMongoId('paramName')` depuis `validateInput.js`.
4. Pour la recherche / regex MongoDB : toujours passer par `sanitizeSearchString` pour les entrées utilisateur.

## Commandes

```bash
cd backend && npm test -- --testPathPattern="validation|security|messages"
```
