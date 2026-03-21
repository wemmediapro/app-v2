# Go-live — actions P0 (lancées / à valider en équipe)

Checklist rapide après implémentation des correctifs « launch » dans le dépôt.

## Sécurité (renforcée)

| Élément                                                                      | Statut                                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `ADMIN_EMAIL` ≠ `admin@gnv.com` en production                                | Déjà appliqué (`security-config.js`, `auth.js`)               |
| `ADMIN_PASSWORD` ≥ **12** caractères en production                           | **Nouveau** — le serveur refuse de démarrer sinon             |
| Mots de passe triviaux bannis (ex. `admin123!`, `password`, `administrator`) | **Nouveau** — liste dans `backend/src/lib/security-config.js` |
| JWT ≥ 32 car., Mongo URI, secrets hors Git                                   | Déjà appliqué                                                 |

**Action équipe** : mettre à jour `ADMIN_PASSWORD` sur les environnements existants si &lt; 12 caractères avant prochain déploiement prod.

## 2FA TOTP (admins)

| Élément                                                  | Statut                                                          |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| Backend : setup / verify / disable, login avec challenge | **Déjà implémenté** (`auth.js`, `authService.js`, `User` model) |
| Guides                                                   | `docs/2FA-USER-GUIDE.md`, `docs/2FA-ADMIN-POLICIES.md`          |

**Action équipe** : activer 2FA sur les comptes admin en production après premier login sécurisé.

## CI/CD & qualité

| Élément                        | Statut                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| GitHub Actions                 | Workflows dans `.github/workflows/`                                                                     |
| Husky + lint-staged + ESLint 9 | **Corrigé** : `ESLINT_USE_FLAT_CONFIG=false` via `cross-env` dans `lint-staged` (racine `package.json`) |

**Action équipe** : `npm install` à la racine puis `git commit` pour vérifier que le pre-commit passe.

## Sentry & staging

| Élément             | Statut                                      |
| ------------------- | ------------------------------------------- |
| Code Sentry         | `backend/src/lib/sentry.js`                 |
| Déploiement staging | Voir `docs/DEPLOYMENT.md`, workflows deploy |

**Action équipe** : renseigner `SENTRY_DSN` et valider un événement test en staging.

## Références

- [DOCUMENTATION-HUB.md](./DOCUMENTATION-HUB.md)
- [INCIDENT-RESPONSE.md](./INCIDENT-RESPONSE.md)
- [SECRET-ROTATION.md](./SECRET-ROTATION.md)
