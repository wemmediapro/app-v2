# Runbook opérations — monitoring, CI/CD, logs, sauvegardes, PRA

Ce document **aligne une checklist type audit** avec l’état du dépôt et décrit ce qu’il reste à **configurer côté infra** (secrets, variables, hébergeur).

## État dans le dépôt vs checklist « manquant »

| Thème                                | Dans le dépôt                                                                                                                          | À faire en prod / infra                                                                                                                                                                                                                                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Monitoring erreurs (type Sentry)** | `@sentry/node`, `backend/src/lib/sentry.js`, branchement dans `server.js` et erreurs API                                               | Définir `SENTRY_DSN` (et alertes dans le projet Sentry). Sans DSN, rien n’est envoyé.                                                                                                                                                                                                                                                  |
| **APM / Datadog**                    | Non intégré (pas d’agent Datadog dans le code)                                                                                         | Option : agent sur la VM + logs stdout, ou OpenTelemetry plus tard.                                                                                                                                                                                                                                                                    |
| **Profiling CPU / heap (Node)**      | Scripts npm + guide [PROFILING.md](./PROFILING.md)                                                                                     | `cd backend && npm run profile:cpu` / `profile:heap` ; sorties dans `backend/profile-out/` (gitignored). Combiner avec k6 pour générer du trafic, puis ouvrir le `.cpuprofile` dans Chrome DevTools.                                                                                                                                   |
| **CI/CD**                            | Workflows GitHub : [`.github/workflows/tests.yml`](../.github/workflows/tests.yml), déploiement staging/prod, CodeQL, sécurité, charge | Vérifier que les secrets / environnements GitHub sont renseignés et que les branches déclenchent bien les bons jobs.                                                                                                                                                                                                                   |
| **Alerting / uptime**                | [`.github/workflows/monitoring-ping.yml`](../.github/workflows/monitoring-ping.yml) — GET `/api/v1/health/ready` toutes les 15 min     | Configurer les **variables** dépôt : `STAGING_PUBLIC_URL`, `PRODUCTION_PUBLIC_URL`, et `MONITORING_PING_PRODUCTION=true` pour activer la prod. Le JSON inclut `mongodb`, **`redis`** (`connected` / `disconnected` / `skipped`) et `ready` : en **production**, Redis doit répondre au `PING` sinon **503** (en dev, Redis optionnel). |
| **Logs**                             | **Pino** structuré (`backend/src/lib/logger.js`), niveau `LOG_LEVEL` ; champs `event` + erreurs via `logRouteError`                    | Les logs sortent sur **stdout** : centraliser via le fournisseur de la VM (journald, Docker logging driver, agent Datadog/Vector/Fluent Bit). Voir [Champs structurés](#champs-structurés-event-erreurs-http-reqid) ci-dessous.                                                                                                        |
| **Sauvegardes**                      | Script `backend/scripts/mongodb-backup.sh` (mongodump + répertoire daté)                                                               | Planifier en cron / CI ; copie hors site. Voir [Procédure sauvegarde](#procédure-de-sauvegarde-phase-1-checklist) + Mongo ci-dessous.                                                                                                                                                                                                  |
| **PRA / reprise**                    | Ce document                                                                                                                            | Maintenir contacts, procédures de restauration testées au moins une fois par trimestre.                                                                                                                                                                                                                                                |

## Activation rapide — variables à ne pas oublier

1. **Sentry** : `SENTRY_DSN` dans `backend/config.env` (production). Voir `backend/config.env.example`.
2. **Ping monitoring** : GitHub → Settings → Secrets and variables → Actions → **Variables** : `STAGING_PUBLIC_URL`, `PRODUCTION_PUBLIC_URL`, optionnellement `MONITORING_PING_PRODUCTION=true`.

## Logs centralisés (recommandation minimale)

1. Lancer le backend sous **PM2** ou systemd en conservant **stdout** en JSON (Pino).
2. Sur la VM : installer un **agent** (ex. Datadog, Vector, ou stack ELK) qui lit les journaux du processus ou des fichiers PM2.
3. Définir des **vues / alertes** sur le taux d’erreurs HTTP 5xx et sur les patterns `level:50` (error) dans les logs JSON.

### Champs structurés (`event`, erreurs HTTP, `reqId`)

- **Pino** (`backend/src/lib/logger.js`) : niveaux standards (`info`, `warn`, `error`, etc.), sortie JSON sur stdout.
- **`event`** : identifiant stable en `snake_case` pour filtrer dans Loki / CloudWatch / Datadog (ex. `redis_connect_failed`, `mongodb_disconnected`, `rate_limit_dev_floor_applied`). Les erreurs de routes utilisent souvent `logRouteError` (`backend/src/lib/route-logger.js`) : même champ `event` + `err` (message) + `stack` si disponible ; quand la requête a un enfant Pino (`req.log` dans `server.js`), le log inclut aussi le **`reqId`** (en-tête **`X-Request-Id`**).
- **Auth** (`auth.js`, via `logRouteError`) : en plus des événements profil / user-data (`auth_me_get_failed`, `auth_register_failed`, etc.), les erreurs login / 2FA utilisent notamment `auth_login_admin_config_missing` (champs `hasAdminEmail`, `hasAdminPassword`), `auth_login_failed` (champ optionnel `email`), `auth_2fa_setup_failed`, `auth_2fa_verify_failed`, `auth_2fa_complete_login_failed`, `auth_2fa_disable_failed`.
- **Admin conversations** : `admin_conversations_list_failed` (agrégation liste), `admin_conversations_unread_failed` (compteur non lus).
- **Admin** : stats / cache / audit (`admin_connections_stats_failed`, `admin_memory_stats_failed`, `admin_list_databases_failed`, `admin_cache_clear_failed`, `admin_audit_logs_*_failed`), conversations (`admin_conversations_*`), dashboard (`admin_dashboard_failed`), liste utilisateurs (`admin_users_list_failed`), CRUD utilisateur (`admin_user_create_failed`, `admin_user_update_failed`, `admin_user_delete_failed`), droits (`admin_settings_access_get_failed`, `admin_settings_access_put_failed`) — couverture tests : `admin.routes-errors.test.js`, `admin.conversations.test.js`.
- **Avertissements** : les anciens `console.warn` applicatifs ont été remplacés par `logger.warn({ event, ... })` (fallbacks fichiers, Redis optionnel, FFmpeg manquant, etc.) — niveau **40** en JSON Pino, utile pour tendances sans alerter comme une panique.
- **Infos démarrage / cycle de vie** : les `console.log` du serveur et des libs (Mongo, Redis cache, modules, upload dirs, écoute HTTP, graceful shutdown, etc.) passent par `logger.info({ event, ... })` — niveau **30** ; filtrage possible avec `LOG_LEVEL=warn` en prod si vous voulez réduire le bruit (les erreurs et warnings restent visibles).
- **Accès HTTP (Morgan)** : chaque requête (hors health, web-vitals, fichiers sous `/uploads/`) est loguée en JSON avec `event: "http_access"` et `line` (format Apache-like, préfixe **reqId** aligné sur `X-Request-Id`). `LOG_LEVEL=warn` masque ces lignes tout en conservant erreurs applicatives.

## Procédure de sauvegarde (Phase 1 — checklist)

À exécuter côté **infra** (cron, fournisseur cloud, ou scripts internes). Objectif : **RPO** défini par la fréquence la plus faible parmi les composants ci-dessous.

| Composant           | Quoi sauvegarder                                                                                      | Comment (indicatif)                                                                     | Rétention / hors site                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **MongoDB**         | Base applicative (`gnv_onboard` ou nom `DB_NAME`)                                                     | Atlas : snapshots planifiés ; self-host : `mongodump` (voir section suivante)           | ≥ 14 jours + copie **hors VM** (S3, autre région)                  |
| **Fichiers médias** | Répertoire uploads du backend (`backend/public/uploads` — vidéos, images, audio, HLS si présent)      | `rsync` / snapshot disque / sauvegarde objet du volume                                  | Aligner sur Mongo (sinon restauration incohérente)                 |
| **Redis**           | Optionnel : cache + rate limit (reconstruisible) ; **sessions Socket** non critiques si JWT stateless | Si données métier dans Redis : `redis-cli SAVE` + copie `dump.rdb`, ou AOF selon config | Souvent 24–48 h suffisent si cache-only                            |
| **Secrets**         | `.env` / gestionnaire de secrets (pas dans le dump Git)                                               | Export chiffré coffre (1Password, Vault, secrets CI)                                    | Hors dépôt ; rotation : [SECRET-ROTATION.md](./SECRET-ROTATION.md) |

**Vérification trimestrielle** : restaurer Mongo + médias sur un **environnement de staging**, lancer l’API, contrôler `/api/v1/health/ready` et un échantillon de contenus (vidéo / image).

## Sauvegardes MongoDB

### MongoDB Atlas

- Activer les **Cloud Backup** / snapshots planifiés dans la console Atlas.
- Documenter la **rétention** et qui peut lancer une **restauration** (accès IAM).

### Instance MongoDB auto-hébergée

Script fourni dans le dépôt (depuis la racine du repo ou `backend/`) :

```bash
export MONGODB_URI="mongodb://user:pass@host:27017/dbname"
# optionnel : BACKUP_ROOT=/var/backups/mongodb
bash backend/scripts/mongodb-backup.sh
```

Exemple cron (utilisateur dédié, répertoire sécurisé) :

```bash
# Quotidien : même logique que le script (adapter le chemin du repo)
0 2 * * * cd /chemin/vers/app/backend && MONGODB_URI="..." BACKUP_ROOT=/var/backups/mongodb bash scripts/mongodb-backup.sh && find /var/backups/mongodb -maxdepth 1 -type d -mtime +14 -exec rm -rf {} \;
```

- Copier les dumps vers un **stockage hors site** (S3, autre région).
- **Tester** une restauration sur une base de **staging** avant d’en avoir besoin en incident.

## Plan de reprise après sinistre (PRA) — squelette

À compléter avec vos noms, contrats et URLs réelles.

| Élément                                           | Détail                                                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Actifs critiques**                              | API Node, MongoDB, Redis, fichiers statiques front + dashboard                                                          |
| **RPO cible**                                     | Ex. « perte max acceptée de données : X heures » (dicté par la fréquence des backups)                                   |
| **RTO cible**                                     | Ex. « service rétabli sous Y heures »                                                                                   |
| **Scénario 1 — Panne VM**                         | Redéploiement depuis CI, restauration Mongo depuis dernier backup, vérification `/api/health` et `/api/v1/health/ready` |
| **Scénario 2 — Corruption / suppression données** | Stop écritures si possible, restore Mongo sur nouvelle instance ou point-in-time (Atlas), bascule `MONGODB_URI`         |
| **Scénario 3 — Compromission**                    | Rotation `JWT_SECRET` (invalidation sessions), secrets admin, révision logs, patch, compte-rendu                        |
| **Communication**                                 | Qui annonce l’incident, canal interne / utilisateurs                                                                    |
| **Post-mortem**                                   | Date, cause, actions correctives                                                                                        |

## Références dans le repo

- Déploiement : [DEPLOYMENT.md](./DEPLOYMENT.md), [PRODUCTION-GUIDE.md](../PRODUCTION-GUIDE.md)
- Améliorations qualité / Sentry : [QUALITY-IMPROVEMENTS.md](./QUALITY-IMPROVEMENTS.md)
- Escalade & rollback (checklist) : [INCIDENT-RESPONSE.md](./INCIDENT-RESPONSE.md)
- Index global : [DOCUMENTATION-HUB.md](./DOCUMENTATION-HUB.md)

---

_Dernière mise à jour : runbook initial (PRA + sauvegardes + alignement checklist)._
