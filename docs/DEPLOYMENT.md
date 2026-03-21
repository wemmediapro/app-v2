# Guide de déploiement — GNV OnBoard

Vue d’ensemble pour passer en **production** : prérequis, build, process manager, reverse proxy, base de données et sécurité.

## Documents détaillés

| Sujet                                       | Fichier                                                               |
| ------------------------------------------- | --------------------------------------------------------------------- |
| Déploiement production (PM2, cluster, perf) | [PRODUCTION-GUIDE.md](../PRODUCTION-GUIDE.md)                         |
| VM / installation rapide                    | [INSTALLATION-RAPIDE-VM.md](../INSTALLATION-RAPIDE-VM.md)             |
| Hébergement VM (résumé)                     | [README-HEBERGEMENT-VM.md](../README-HEBERGEMENT-VM.md)               |
| Nginx (exemple)                             | `nginx.conf` à la racine du dépôt                                     |
| Sécurité (checklist)                        | [SECURITY.md](../SECURITY.md)                                         |
| Monitoring, CI/CD, backups, PRA (runbook)   | [OPS-RUNBOOK.md](./OPS-RUNBOOK.md)                                    |
| Sécurité backend (détail)                   | [backend/docs/SECURITY.md](../backend/docs/SECURITY.md)               |
| Validateurs API                             | [backend/docs/VALIDATION.md](../backend/docs/VALIDATION.md)           |
| Auth JWT                                    | [backend/docs/AUTH-MIDDLEWARE.md](../backend/docs/AUTH-MIDDLEWARE.md) |

## Architecture cible (résumé)

1. **Frontend passagers** + **dashboard** : build statique (`npm run build`, `dashboard/npm run build`), servis par **Nginx**.
2. **Backend Node.js** : API + Socket.io, souvent **PM2** (`ecosystem.production.cjs`) + **cluster**.
3. **MongoDB** : Atlas ou instance dédiée.
4. **Redis** : obligatoire en production (rate limit, Socket.io adapter, cache).

## Checklist avant mise en production

- [ ] `backend/config.env` : `JWT_SECRET` ≥ 32 caractères, `MONGODB_URI`, `REDIS_URI` / `REDIS_URL`, `FRONTEND_URL` (toutes les origines).
- [ ] HTTPS (ex. Let’s Encrypt) + en-têtes sécurisés (voir `nginx.conf`).
- [ ] Builds front : `npm run build` (racine) et `cd dashboard && npm run build`.
- [ ] Pas de `RATE_LIMIT_LOAD_TEST=1` en prod (`server.js` ignore en prod, mais à éviter dans les fichiers déployés).
- [ ] Comptes admin : `ADMIN_EMAIL` ≠ `admin@gnv.com`, mots de passe forts ; pas de secrets dans les logs (voir [SECURITY.md](../SECURITY.md)).

## Initialisation de la base de données

| Script                        | Commande                               | Usage                                                                                        |
| ----------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Recommandé (API Mongoose)** | `cd backend && npm run init-db`        | `init-database.js` — aligné avec l’application.                                              |
| **Prisma (legacy)**           | `cd backend && npm run init-db-prisma` | `init-database-prisma.js` — hors chemin API ; **non recommandé en prod** sauf besoin précis. |

### Script Prisma (`init-database-prisma.js`)

- Marqué **LEGACY** dans l’en-tête du fichier.
- **`ADMIN_EMAIL` obligatoire** dans tous les environnements (aucun email par défaut).
- En **production** : `ADMIN_PASSWORD` **obligatoire** (sinon le script quitte).
- En **développement** : si `ADMIN_PASSWORD` est absent, génération d’un mot de passe temporaire **32 caractères hex**, affiché **une fois** sur la console ; en base, `mustChangePassword=true` (aligné avec `init-database.js` / API Mongoose).

## Variables d’environnement (rappel)

Copier `backend/config.env.example` → `backend/config.env` et adapter. Côté front (Vite), copier `.env.example` → `.env` (voir commentaires pour `DEV_PROXY_TARGET` si le backend n’est pas sur le port 3000).

## Après déploiement

- `pm2 save` / `pm2 startup` si PM2.
- Vérifier `/api/health` et une route métier authentifiée.
- Monitoring optionnel : `SENTRY_DSN` dans `config.env`.

---

_Pour le détail des étapes PM2, Nginx et tuning charge, suivre [PRODUCTION-GUIDE.md](../PRODUCTION-GUIDE.md)._
