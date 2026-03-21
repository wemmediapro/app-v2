# GitHub — CI/CD, protections de branche et secrets

Dépôt CI/CD de référence : **[wemmediapro/app-v2](https://github.com/wemmediapro/app-v2)** (badges README et Codecov y sont alignés).

Ce document complète les workflows dans `.github/workflows/`. Les **paramètres d’organisation/dépôt** (reviews obligatoires, environnements) se configurent dans l’interface GitHub, pas dans le code.

**Runtime** : tous les workflows Actions utilisent **Node.js 22** (`NODE_VERSION`), en cohérence avec `load-test.yml` et les stacks locales récentes.

## Workflows

| Fichier | Déclencheur | Rôle |
|---------|-------------|------|
| `tests.yml` | `push` / `pull_request` sur `main`, `develop` | Frontend (Vitest + Playwright + Codecov), backend (Jest + Codecov), k6 sur **PR uniquement**, `npm audit` |
| `load-test.yml` | `push` sur `main`, `workflow_dispatch` | Charge k6 (+ Artillery optionnel) |
| `deploy-staging.yml` | `push` sur `develop` | Tests gate, build, déploiement staging (si activé) |
| `deploy-prod.yml` | `workflow_dispatch` (saisie `DEPLOY`) | Tests, build, déploiement prod (si activé), health check |
| `security.yml` | Cron quotidien + `workflow_dispatch` | Audit npm, OWASP Dependency-Check, Snyk optionnel |

## Branch protection (à activer sur GitHub)

**Settings → Branches → Branch protection rules** pour `main` (et éventuellement `develop`) :

1. **Require a pull request before merging**
   - Require approvals : **1** (ou **2** selon votre politique)
   - **Dismiss stale pull request approvals when new commits are pushed**
2. **Require status checks to pass before merging**
   - Ajouter les jobs requis, par ex. :
     - `Frontend Tests`
     - `Backend Tests`
     - `Security Scan (npm audit)`
     - Sur PR : `Load Tests (k6, PR)` (si vous voulez bloquer la fusion sur la charge)
3. (Optionnel) **Require conversation resolution before merging**
4. (Optionnel) **Do not allow bypassing the above settings** pour les admins

> Les **2 reviewers** pour la production se configurent plutôt sur l’**environnement** :  
> **Settings → Environments → `production` → Required reviewers** (2 personnes).

## Secrets et variables

### Secrets (Settings → Secrets and variables → Actions)

| Secret | Usage |
|--------|--------|
| `CODECOV_TOKEN` | Upload des rapports de couverture (optionnel si Codecov désactivé) |
| `SNYK_TOKEN` | Scan Snyk dans `security.yml` |
| `HEROKU_API_KEY` / `RAILWAY_TOKEN` / etc. | Déploiement (à brancher dans les jobs `deploy-*`) |

### Variables (repository ou environment)

| Variable | Usage |
|----------|--------|
| `STAGING_DEPLOY_ENABLED` | Mettre à `true` pour exécuter le job de déploiement staging |
| `STAGING_PUBLIC_URL` | URL publique du staging (smoke test `GET /api/health`) |
| `PRODUCTION_DEPLOY_ENABLED` | Mettre à `true` pour le job de déploiement prod |
| `PRODUCTION_PUBLIC_URL` | URL prod pour le health check post-déploiement |

## Codecov

1. Créer un projet sur [codecov.io](https://codecov.io) lié au dépôt.
2. Ajouter `CODECOV_TOKEN` dans les secrets GitHub.
3. Les flags `frontend` et `backend` séparent les rapports dans Codecov.

## Déploiement Heroku / Railway

Les fichiers `deploy-staging.yml` et `deploy-prod.yml` contiennent des **étapes placeholder**. Remplacez-les par :

- **Heroku** : `git push` vers le remote Heroku, ou une action du marketplace (`akhileshns/heroku-deploy`, etc.).
- **Railway** : CLI `railway up` avec `RAILWAY_TOKEN`, ou webhook de déploiement.

Le **rollback** automatique n’est pas universel : en cas d’échec du health check, le workflow échoue et la doc indique un rollback manuel (Heroku : `heroku releases:rollback`, etc.).
