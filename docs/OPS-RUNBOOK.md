# Runbook opérations — monitoring, CI/CD, logs, sauvegardes, PRA

Ce document **aligne une checklist type audit** avec l’état du dépôt et décrit ce qu’il reste à **configurer côté infra** (secrets, variables, hébergeur).

## État dans le dépôt vs checklist « manquant »

| Thème | Dans le dépôt | À faire en prod / infra |
| ----- | ------------- | ------------------------ |
| **Monitoring erreurs (type Sentry)** | `@sentry/node`, `backend/src/lib/sentry.js`, branchement dans `server.js` et erreurs API | Définir `SENTRY_DSN` (et alertes dans le projet Sentry). Sans DSN, rien n’est envoyé. |
| **APM / Datadog** | Non intégré (pas d’agent Datadog dans le code) | Option : agent sur la VM + logs stdout, ou OpenTelemetry plus tard. |
| **CI/CD** | Workflows GitHub : [`.github/workflows/tests.yml`](../.github/workflows/tests.yml), déploiement staging/prod, CodeQL, sécurité, charge | Vérifier que les secrets / environnements GitHub sont renseignés et que les branches déclenchent bien les bons jobs. |
| **Alerting / uptime** | [`.github/workflows/monitoring-ping.yml`](../.github/workflows/monitoring-ping.yml) — GET `/api/v1/health/ready` toutes les 15 min | Configurer les **variables** dépôt : `STAGING_PUBLIC_URL`, `PRODUCTION_PUBLIC_URL`, et `MONITORING_PING_PRODUCTION=true` pour activer la prod. Les échecs de workflow peuvent notifier via les paramètres GitHub (ou compléter avec UptimeRobot / Better Stack, etc.). |
| **Logs** | **Pino** structuré (`backend/src/lib/logger.js`), niveau `LOG_LEVEL` | Les logs sortent sur **stdout** : centraliser via le fournisseur de la VM (journald, Docker logging driver, agent Datadog/Vector/Fluent Bit). Ce n’est pas « console only » côté appli si les routes utilisent `logger`. |
| **Sauvegardes** | Pas de cron dans le repo (dépend de MongoDB hébergé) | Voir section ci-dessous (Atlas / mongodump). |
| **PRA / reprise** | Ce document | Maintenir contacts, procédures de restauration testées au moins une fois par trimestre. |

## Activation rapide — variables à ne pas oublier

1. **Sentry** : `SENTRY_DSN` dans `backend/config.env` (production). Voir `backend/config.env.example`.
2. **Ping monitoring** : GitHub → Settings → Secrets and variables → Actions → **Variables** : `STAGING_PUBLIC_URL`, `PRODUCTION_PUBLIC_URL`, optionnellement `MONITORING_PING_PRODUCTION=true`.

## Logs centralisés (recommandation minimale)

1. Lancer le backend sous **PM2** ou systemd en conservant **stdout** en JSON (Pino).
2. Sur la VM : installer un **agent** (ex. Datadog, Vector, ou stack ELK) qui lit les journaux du processus ou des fichiers PM2.
3. Définir des **vues / alertes** sur le taux d’erreurs HTTP 5xx et sur les patterns `level:50` (error) dans les logs JSON.

## Sauvegardes MongoDB

### MongoDB Atlas

- Activer les **Cloud Backup** / snapshots planifiés dans la console Atlas.
- Documenter la **rétention** et qui peut lancer une **restauration** (accès IAM).

### Instance MongoDB auto-hébergée

Exemple de stratégie (à adapter : chemins, auth, réseau) :

```bash
# Quotidien via cron (utilisateur dédié, répertoire sécurisé)
0 2 * * * mongodump --uri="$MONGODB_URI" --out=/var/backups/mongodb/$(date +\%Y\%m\%d) && find /var/backups/mongodb -maxdepth 1 -type d -mtime +14 -exec rm -rf {} \;
```

- Copier les dumps vers un **stockage hors site** (S3, autre région).
- **Tester** une restauration sur une base de **staging** avant d’en avoir besoin en incident.

## Plan de reprise après sinistre (PRA) — squelette

À compléter avec vos noms, contrats et URLs réelles.

| Élément | Détail |
| ------- | ------ |
| **Actifs critiques** | API Node, MongoDB, Redis, fichiers statiques front + dashboard |
| **RPO cible** | Ex. « perte max acceptée de données : X heures » (dicté par la fréquence des backups) |
| **RTO cible** | Ex. « service rétabli sous Y heures » |
| **Scénario 1 — Panne VM** | Redéploiement depuis CI, restauration Mongo depuis dernier backup, vérification `/api/health` et `/api/v1/health/ready` |
| **Scénario 2 — Corruption / suppression données** | Stop écritures si possible, restore Mongo sur nouvelle instance ou point-in-time (Atlas), bascule `MONGODB_URI` |
| **Scénario 3 — Compromission** | Rotation `JWT_SECRET` (invalidation sessions), secrets admin, révision logs, patch, compte-rendu |
| **Communication** | Qui annonce l’incident, canal interne / utilisateurs |
| **Post-mortem** | Date, cause, actions correctives |

## Références dans le repo

- Déploiement : [DEPLOYMENT.md](./DEPLOYMENT.md), [PRODUCTION-GUIDE.md](../PRODUCTION-GUIDE.md)
- Améliorations qualité / Sentry : [QUALITY-IMPROVEMENTS.md](./QUALITY-IMPROVEMENTS.md)
- Escalade & rollback (checklist) : [INCIDENT-RESPONSE.md](./INCIDENT-RESPONSE.md)
- Index global : [DOCUMENTATION-HUB.md](./DOCUMENTATION-HUB.md)

---

_Dernière mise à jour : runbook initial (PRA + sauvegardes + alignement checklist)._
