# Sécurité — GNV OnBoard

Guide opérationnel et checklist pour l’équipe. Détails d’implémentation : `backend/docs/SECURITY.md`.

## Credentials administrateur

| Règle               | Détail                                                                                                                                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Variables           | `ADMIN_EMAIL` et `ADMIN_PASSWORD` **obligatoires** dans `config.env` / `.env`. Aucune valeur codée en dur dans le code applicatif.                                                                                                                             |
| Production          | `validateSecurityConfig()` refuse le démarrage si l’une manque, si `JWT_SECRET` &lt; 32 caractères, si `ADMIN_EMAIL` = `admin@gnv.com`, si `ADMIN_PASSWORD` &lt; **12** caractères, ou si le mot de passe figure dans la liste de mots de passe triviaux (voir `backend/src/lib/security-config.js`). |
| Login               | `POST /api/auth/login` renvoie **500** si la config admin est incomplète ; **403** si tentative avec `admin@gnv.com` en production.                                                                                                                            |
| Init DB             | `npm run init-db` : en prod, mot de passe admin **obligatoire** ; en dev, sans `ADMIN_PASSWORD`, génération d’un mot de passe temporaire **32 caractères hex**, affiché **une fois**, avec `mustChangePassword=true` jusqu’au `PUT /api/auth/change-password`. |
| Réinit mot de passe | `scripts/reset-admin-password.js` exige `ADMIN_EMAIL` + `ADMIN_PASSWORD_RESET` (pas de mot de passe par défaut).                                                                                                                                               |

**Ne jamais** commiter de vrais secrets ni réutiliser des identifiants de démo publics.

## 2FA (TOTP) — implémenté pour les admins

- **Routes** : `POST /api/auth/2fa/setup`, `/verify`, `/disable`, `/2fa/complete-login` ; login en deux étapes si `twoFactorEnabled`.
- **Guides** : [docs/2FA-USER-GUIDE.md](docs/2FA-USER-GUIDE.md) (utilisateur), [docs/2FA-ADMIN-POLICIES.md](docs/2FA-ADMIN-POLICIES.md) (politiques / ops).
- **Dépendances** : `speakeasy`, `qrcode` (backend).

## Rate limiting

- **Login** : `express-rate-limit` sur `POST /api/auth/login` — `LOGIN_RATE_LIMIT_MAX` (défaut **5** / 15 min / IP). Ajuster selon la taille du navire / NAT.
- **API globale** : `RATE_LIMIT_WINDOW`, `RATE_LIMIT_MAX` dans `config.env`.
- **Sockets** : voir `SOCKET_RATE_*` et limites par IP Redis (`MAX_CONNECTIONS_PER_IP`).

En production, ne pas activer `RATE_LIMIT_LOAD_TEST`.

## JWT — bonnes pratiques

- Secret **≥ 32** caractères aléatoires, uniquement via variables d’environnement.
- Durée de vie : `JWT_EXPIRE` / `JWT_EXPIRES_IN` — privilégier des durées courtes + refresh pour le dashboard.
- Les tokens sont posés en cookie **httpOnly** (`authToken`) — ne pas les renvoyer dans le corps JSON des réponses login/register.
- Blacklist optionnelle à la déconnexion si Redis/cache actif.

## CORS

- `FRONTEND_URL` : liste d’origines séparées par des virgules, alignées sur les domaines réels du PWA / dashboard.
- Ne pas utiliser `*` avec `credentials: true`.
- Vérifier les en-têtes `X-Forwarded-Proto` derrière reverse proxy pour cookies `secure`.

## Checklist avant mise en production

- [ ] `ADMIN_EMAIL` ≠ `admin@gnv.com`, mot de passe fort unique
- [ ] `JWT_SECRET` ≥ 32 caractères aléatoires
- [ ] `MONGODB_URI` / `DATABASE_URL` avec auth réseau restreint
- [ ] Redis avec mot de passe (`REDIS_URI`)
- [ ] `NODE_ENV=production`, pas de `FORCE_DEMO=true`
- [ ] CORS = domaines de prod uniquement
- [ ] HTTPS terminé correctement (cookies secure)
- [ ] `npm run audit:ci` et `npm run audit:security-credentials` (backend) OK

## Scripts d’audit

```bash
cd backend
npm run audit:ci
npm run audit:security-credentials
```

`audit:security-credentials` vérifie la présence des clés attendues dans les fichiers d’exemple et l’absence de mots de passe de démo évidents dans les scripts sensibles (heuristique).
