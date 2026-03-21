# Hub documentation — GNV OnBoard

Ce fichier est le **point d’entrée** pour les audits « documentation manquante ». La plupart des sujets sont **déjà couverts** dans `docs/` ; les liens ci-dessous indiquent où lire et ce qu’il reste à enrichir (OpenAPI route par route, etc.).

## API & intégration

| Besoin                        | Document / artefact                                                                        | Statut                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Swagger / OpenAPI             | [OPENAPI.md](./OPENAPI.md), UI `http://localhost:3000/api-docs`, JSON `GET /api-docs.json` | **OK** — spec partielle : seules les routes annotées `@swagger` apparaissent ; à compléter progressivement |
| Export machine                | `backend/docs/openapi.json` — `cd backend && npm run openapi:json`                         | **OK**                                                                                                     |
| Schémas requête/réponse       | [API-SCHEMA.md](./API-SCHEMA.md), `backend/src/lib/swagger.js` (`components.schemas`)      | **Partiel** — aligner avec chaque route au fil des PR                                                      |
| Collection Postman / Insomnia | [POSTMAN-INSOMNIA.md](./POSTMAN-INSOMNIA.md)                                               | **OK** (import depuis OpenAPI)                                                                             |

## Tests

| Besoin            | Document                                                                            | Statut                                   |
| ----------------- | ----------------------------------------------------------------------------------- | ---------------------------------------- |
| Guide global      | [TESTING.md](./TESTING.md)                                                          | **OK**                                   |
| Backend Jest      | [backend/tests/README.md](../backend/tests/README.md)                               | **OK** (fixtures, couverture, objectifs) |
| Exemples concrets | Voir section « Exemples » dans [TESTING.md](./TESTING.md)                           | **OK**                                   |
| Charge / load     | [tests/load/README.md](../tests/load/README.md), [PERFORMANCE.md](./PERFORMANCE.md) | **OK**                                   |

## Opérations & incidents

| Besoin                            | Document                                                                        | Statut                            |
| --------------------------------- | ------------------------------------------------------------------------------- | --------------------------------- |
| Monitoring, sauvegardes, PRA      | [OPS-RUNBOOK.md](./OPS-RUNBOOK.md)                                              | **OK**                            |
| Escalade, rollback, health checks | [INCIDENT-RESPONSE.md](./INCIDENT-RESPONSE.md)                                  | **OK** (checklist opérationnelle) |
| Déploiement                       | [DEPLOYMENT.md](./DEPLOYMENT.md), [PRODUCTION-GUIDE.md](../PRODUCTION-GUIDE.md) | **OK**                            |

## Performance & cache

| Besoin                             | Document                                                                                               | Statut |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ | ------ |
| Cache Redis, Mongo, rate limit, k6 | [PERFORMANCE.md](./PERFORMANCE.md)                                                                     | **OK** |
| Streaming / Nginx                  | [CACHE-STREAMING.md](./CACHE-STREAMING.md), [NGINX-STREAMING-SERVEUR.md](./NGINX-STREAMING-SERVEUR.md) | **OK** |

## Sécurité

| Besoin               | Document                                                                                   | Statut |
| -------------------- | ------------------------------------------------------------------------------------------ | ------ |
| Synthèse dev         | [SECURITY-BEST-PRACTICES.md](./SECURITY-BEST-PRACTICES.md)                                 | **OK** |
| Checklist prod       | [SECURITY.md](../SECURITY.md), [backend/docs/SECURITY.md](../backend/docs/SECURITY.md)     | **OK** |
| 2FA                  | [2FA-USER-GUIDE.md](./2FA-USER-GUIDE.md), [2FA-ADMIN-POLICIES.md](./2FA-ADMIN-POLICIES.md) | **OK** |
| Rotation des secrets | [SECRET-ROTATION.md](./SECRET-ROTATION.md)                                                 | **OK** |
| Journaux d’audit     | [AUDIT-LOGGING-POLICY.md](./AUDIT-LOGGING-POLICY.md)                                       | **OK** |

## Données & modèle

| Besoin                             | Document                                   | Statut                                               |
| ---------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| ERD conceptuel, collections, index | [DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md) | **OK** (vue d’ensemble ; détail = fichiers Mongoose) |
| Prisma vs Mongoose                 | [BACKEND-PRISMA.md](./BACKEND-PRISMA.md)   | **OK**                                               |

## Qualité & CI

| Besoin                  | Document                                             | Statut |
| ----------------------- | ---------------------------------------------------- | ------ |
| GitHub Actions, secrets | [GITHUB_CI_CD.md](./GITHUB_CI_CD.md)                 | **OK** |
| Pistes d’amélioration   | [QUALITY-IMPROVEMENTS.md](./QUALITY-IMPROVEMENTS.md) | **OK** |

---

**À faire en continu (pas « manquant » mais dette doc)** : ajouter des blocs `@swagger` sur chaque route publique dans `backend/src/routes/*.js` et regénérer `openapi.json` ; monter la couverture de tests comme décrit dans `backend/tests/README.md`.

**Go-live P0** : [GO-LIVE-P0.md](./GO-LIVE-P0.md) — sécurité admin, 2FA, Husky/ESLint, Sentry.
