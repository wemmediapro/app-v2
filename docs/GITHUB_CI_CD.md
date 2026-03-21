# GitHub — CI/CD, protections de branche et secrets

Dépôt CI/CD de référence : **[wemmediapro/app-v2](https://github.com/wemmediapro/app-v2)** (badges README et Codecov y sont alignés).

Ce document complète les workflows dans `.github/workflows/`. Les **paramètres d’organisation/dépôt** (reviews obligatoires, environnements) se configurent dans l’interface GitHub, pas dans le code.

**Runtime** : tous les workflows Actions utilisent **Node.js 22** (`NODE_VERSION`), en cohérence avec `load-test.yml` et les stacks locales récentes.

## Workflows

| Fichier | Déclencheur | Rôle |
|---------|-------------|------|
| `tests.yml` | `push` / `pull_request` sur `main`, `develop` | Frontend (Vitest + Playwright + Codecov), backend (Jest + Codecov), **dashboard** (build + audit), k6 sur **PR uniquement**, `npm audit` |
| `codeql.yml` | `push` / `pull_request` / cron hebdo | Analyse sémantique GitHub CodeQL (JS/TS) |
| `load-test.yml` | `push` sur `main`, `workflow_dispatch` | Charge k6 (+ Artillery optionnel) |
| `deploy-staging.yml` | `push` sur `develop` | Tests gate, build, déploiement staging (si activé) |
| `deploy-prod.yml` | `workflow_dispatch` (saisie `DEPLOY`) | Tests, build, déploiement prod (si activé), readiness `GET /api/health/ready` |
| `security.yml` | Cron quotidien + `workflow_dispatch` | Audit npm, OWASP Dependency-Check (action épinglée par SHA), Snyk optionnel |
| `monitoring-ping.yml` | Toutes les **15 min** + manuel | Sonde HTTP vers staging ; prod seulement si variable activée (voir ci-dessous) |

## Dependabot

Le fichier [`.github/dependabot.yml`](../.github/dependabot.yml) ouvre des PR hebdomadaires pour `npm` (racine, `backend/`, `dashboard/`) et pour les **GitHub Actions**. À fusionner après revue + CI verte.

## Monitoring synthétique (Actions)

- **Staging** : si `STAGING_PUBLIC_URL` est défini, le workflow appelle `GET …/api/health/ready` toutes les 15 minutes (`curl` échoue sur **503** si MongoDB est down).
- **Production** : définir en plus `MONITORING_PING_PRODUCTION=true` pour activer la sonde prod (évite du trafic involontaire).

**Backend** : `GET /api/health` reste une **liveness** (réponse 200 si le process répond). `GET /api/health/ready` est la **readiness** (503 sans MongoDB).

## CodeQL

Les résultats apparaissent sous **Security → Code scanning**. Ajoutez le job **Analyze** (workflow CodeQL) aux checks requis sur `main` si vous voulez bloquer les merges sur les alertes configurées en « error ».

## Branch protection (à activer sur GitHub)

**Settings → Branches → Branch protection rules** pour `main` (et éventuellement `develop`) :

1. **Require a pull request before merging**
   - Require approvals : **1** (ou **2** selon votre politique)
   - **Dismiss stale pull request approvals when new commits are pushed**
2. **Require status checks to pass before merging**
   - Ajouter les jobs requis, par ex. :
     - `Frontend Tests`
     - `Backend Tests`
     - `Dashboard build + audit`
     - `Security Scan (npm audit)`
     - `Analyze` (CodeQL), si activé
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
| `PRODUCTION_PUBLIC_URL` | URL prod pour le readiness check post-déploiement (`/api/health/ready`) |
| `MONITORING_PING_PRODUCTION` | Mettre à `true` pour que `monitoring-ping.yml` sonde aussi la prod |

## Codecov

1. Créer un projet sur [codecov.io](https://codecov.io) lié au dépôt.
2. Ajouter `CODECOV_TOKEN` dans les secrets GitHub.
3. Les flags `frontend` et `backend` séparent les rapports dans Codecov.

## Déploiement Heroku / Railway

Les fichiers `deploy-staging.yml` et `deploy-prod.yml` contiennent des **étapes placeholder**. Remplacez-les par :

- **Heroku** : `git push` vers le remote Heroku, ou une action du marketplace (`akhileshns/heroku-deploy`, etc.).
- **Railway** : CLI `railway up` avec `RAILWAY_TOKEN`, ou webhook de déploiement.

Le **rollback** automatique n’est pas universel : en cas d’échec du health check, le workflow échoue et la doc indique un rollback manuel (Heroku : `heroku releases:rollback`, etc.).
