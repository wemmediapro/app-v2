# Plan de réponse aux incidents — checklist

Document **opérationnel** complémentaire au [OPS-RUNBOOK.md](./OPS-RUNBOOK.md) (sauvegardes, monitoring, PRA). À adapter avec vos **contacts réels** (téléphone, Slack, astreinte).

## 1. Niveaux de gravité (exemple)

| Niveau | Exemple                                               | Action immédiate                                |
| ------ | ----------------------------------------------------- | ----------------------------------------------- |
| **P1** | API indisponible pour tous, perte de données en cours | Astreinte dev + ops, communication utilisateurs |
| **P2** | Dégradation forte (latence, erreurs partielles)       | Investigation prioritaire, mitigation           |
| **P3** | Bug limité, contournement possible                    | Ticket + correctif planifié                     |

## 2. Escalade (à personnaliser)

1. **Détection** : alerte Sentry, workflow GitHub `monitoring-ping.yml` en échec, utilisateur, métrique.
2. **Premier intervenant** : _[rôle / nom]_ — vérifie health checks (§4).
3. **Niveau 2** : _[lead technique]_ — logs, base, déploiement récent.
4. **Décision métier / communication** : _[responsable produit / direction]_.

## 3. Health checks (à exécuter en premier)

Remplacez `BASE` par l’URL publique de l’API (staging ou prod).

```bash
# Liveness (process, mémoire, etc.)
curl -sS -o /dev/null -w "%{http_code}\n" "$BASE/api/v1/health"

# Readiness (MongoDB joignable)
curl -sS -o /dev/null -w "%{http_code}\n" "$BASE/api/v1/health/ready"
```

Codes attendus : **200**. Sinon : consulter les logs applicatifs (Pino sur stdout), état MongoDB/Redis, charge VM.

**Monitoring automatisé** : voir [OPS-RUNBOOK.md](./OPS-RUNBOOK.md) — variables `STAGING_PUBLIC_URL`, `PRODUCTION_PUBLIC_URL`, workflow `monitoring-ping.yml`.

## 4. Rollback applicatif (déploiement récent en cause)

Procédure type (selon votre hébergeur : PM2, Docker, GitHub Actions, etc.) :

1. Identifier le **dernier déploiement stable** (tag, commit, image Docker).
2. **Redéployer** la version précédente depuis la CI ou l’image conservée.
3. Vérifier **`/api/v1/health`** et **`/api/v1/health/ready`**.
4. Si la base a reçu une **migration destructive** : ne pas rollback code seul — restaurer backup (voir OPS-RUNBOOK).

Documenter le **numéro de version** déployée après rollback.

## 5. Rollback / restauration données

- **MongoDB Atlas** : point-in-time ou snapshot — procédure dans la console Atlas + mise à jour de `MONGODB_URI` si nouvelle instance.
- **Auto-hébergé** : `mongorestore` depuis dernier `mongodump` — détail [OPS-RUNBOOK.md](./OPS-RUNBOOK.md).

## 6. Incident sécurité (compromission suspectée)

1. Révoquer / faire pivoter les secrets : [SECRET-ROTATION.md](./SECRET-ROTATION.md).
2. Examiner [journaux d’audit](./AUDIT-LOGGING-POLICY.md) et logs d’accès (Nginx, Mongo).
3. Patcher, post-mortem, communication conforme à la politique interne.

## 7. Après l’incident

- **Post-mortem** : cause racine, chronologie, actions préventives (voir tableau PRA dans OPS-RUNBOOK).
- Mettre à jour ce document si les procédures ont changé.

## Références

- [OPS-RUNBOOK.md](./OPS-RUNBOOK.md) — sauvegardes, logs, Sentry, charge
- [DEPLOYMENT.md](./DEPLOYMENT.md) — déploiement
- [SECURITY.md](../SECURITY.md) — politique sécurité
