# Guide utilisateur — Activer l’authentification à deux facteurs (2FA)

Ce guide s’adresse aux **administrateurs** du dashboard GNV OnBoard.

## Prérequis

- Compte avec le rôle **admin**
- Application d’authentification (Google Authenticator, Microsoft Authenticator, Authy, etc.)

## Étapes

### 1. Connexion classique

Connectez-vous avec votre **email** et **mot de passe** comme d’habitude.

### 2. Démarrer la configuration 2FA

Envoyez une requête authentifiée :

- **POST** `/api/auth/2fa/setup`
- En-tête : cookie `authToken` (session) ou `Authorization: Bearer <token>`

La réponse JSON contient :

- **`qrCodeDataUrl`** : image PNG en data URL à scanner dans l’app TOTP
- **`manualEntryKey`** : clé base32 si vous préférez la saisie manuelle
- **`backupCodes`** : **10 codes de secours** — **enregistrez-les hors ligne** (coffre-fort de mots de passe). Ils ne seront **plus affichés**.

### 3. Valider avec un code TOTP

Une fois l’appareil enregistré dans l’app :

- **POST** `/api/auth/2fa/verify`
- Corps JSON : `{ "token": "123456" }` (code à 6 chiffres affiché par l’app)

Le serveur active le 2FA et renvoie un **nouveau cookie de session** incluant la validation MFA.

### 4. Prochaines connexions

Si le 2FA est actif pour votre compte admin :

1. **POST** `/api/auth/login` avec email + mot de passe
2. Réponse **`requiresTwoFactor: true`** et **`twoFactorChallenge`** (JWT court, ~5 min) — **pas encore de session complète**
3. Soit :
   - renvoyer **POST** `/api/auth/login` avec en plus **`twoFactorToken`** (TOTP 6 chiffres ou **code de secours**), **ou**
   - **POST** `/api/auth/2fa/complete-login` avec `{ "twoFactorChallenge": "<jwt>", "token": "<totp ou code>" }`

Ensuite le cookie `authToken` est celui d’une session **MFA complète**.

### 5. Requêtes API (option avancée)

Pour une seule requête sans refaire un login complet, vous pouvez envoyer l’en-tête :

`X-2FA-Token: 123456`

(code TOTP courant, 6 chiffres), en plus du JWT habituel — **uniquement** si votre compte admin a le 2FA activé et que le JWT ne contient pas encore `mfa`.

## Désactiver le 2FA

- **POST** `/api/auth/2fa/disable`
- Corps : `{ "password": "...", "twoFactorToken": "123456" }`
- Nécessite une session admin **avec MFA validée** (JWT émis après login 2FA ou après `/verify`).

## Dépannage

- **Challenge expiré** : refaire l’étape login mot de passe pour obtenir un nouveau `twoFactorChallenge`.
- **Code refusé** : vérifier l’heure du téléphone (TOTP sensible au décalage horaire).
- **Code de secours** : chaque code n’est utilisable **qu’une fois** ; après usage il est retiré du compte.

Pour plus de politique côté organisation, voir [2FA-ADMIN-POLICIES.md](./2FA-ADMIN-POLICIES.md).
