# Politiques administrateur — 2FA (GNV OnBoard)

## Portée

- Le 2FA implémenté est **TOTP** (RFC 6238) via `speakeasy`, avec **codes de secours** hashés (bcrypt) en base.
- S’applique aux comptes dont le champ MongoDB **`role`** vaut **`admin`** et **`twoFactorEnabled: true`**.

## Exigences techniques

| Élément | Détail |
|--------|--------|
| Secret TOTP | Stocké en base (`twoFactorSecret`, `select: false`), base32. |
| Activation | Deux étapes : `POST /api/auth/2fa/setup` puis `POST /api/auth/2fa/verify` avec un code TOTP valide. |
| Session | JWT inclut **`mfa: true`** après login 2FA complet ou après `/verify`. |
| Challenge intermédiaire | JWT à usage unique **`typ: '2fa_challenge'`**, TTL configurable (`TWO_FACTOR_CHALLENGE_EXPIRES_IN`, défaut 5 min). |
| Routes sans MFA sur JWT « partiel » | `/auth/login`, `/auth/logout`, `/auth/2fa/complete-login`, `/auth/me`, `/auth/2fa/setup`, `/auth/2fa/verify`. |
| Désactivation | `POST /auth/2fa/disable` : **mot de passe + TOTP** ; **non** listé comme exempt MFA — le JWT doit être une session MFA complète **ou** utiliser `X-2FA-Token`. |

## Contrôle d’accès

- Toute autre route sous `/api/*` protégée par `authMiddleware` : si **admin + twoFactorEnabled** et JWT **sans** `mfa: true` → **401** `MFA_REQUIRED`, sauf exemptions ci-dessus.
- Alternative ponctuelle : en-tête **`X-2FA-Token`** avec code TOTP à 6 chiffres (fenêtre `TOTP_WINDOW`, défaut 1 pas de 30 s).

## Variables d’environnement (optionnel)

| Variable | Rôle |
|----------|------|
| `TWO_FACTOR_ISSUER` / `TWO_FACTOR_APP_NAME` | Nom affiché dans l’app TOTP (défaut : `GNV OnBoard`). |
| `TWO_FACTOR_CHALLENGE_EXPIRES_IN` | Durée du JWT challenge (ex. `5m`, `10m`). |
| `TOTP_WINDOW` | Fenêtre de validation TOTP (défaut `1`). |

## Audit & opérations

- Faire exécuter **`POST /2fa/setup` + `/verify`** à chaque nouvel administrateur avant accès aux routes sensibles (`/api/admin`, etc.).
- En cas de perte d’appareil : procédure de **codes de secours** ou réinitialisation contrôlée (support + vérification d’identité hors périmètre code).
- Tests automatisés : `npm test -- --testPathPattern="auth.2fa-flow|authService|authMiddleware.flow"`.

## CSRF

- **`POST /api/auth/2fa/complete-login`** est **exempté** du double-submit CSRF (comme le login), car utilisé avant session stable avec cookie CSRF cohérent.

## Références

- [Guide utilisateur](./2FA-USER-GUIDE.md)  
- [SECURITY.md](../SECURITY.md) (racine du dépôt)  
- `backend/src/services/authService.js`, `backend/src/routes/auth.js`, `backend/src/middleware/auth.js`
