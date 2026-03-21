# Politique des journaux d’audit (admin)

Les actions sensibles des **administrateurs** peuvent être tracées dans la collection MongoDB **`auditlogs`** (modèle `AuditLog`, `backend/src/models/AuditLog.js`).

## Rétention

- **Objectif minimal** : conserver les entrées **1 an** pour investigation et conformité interne (ajustable selon votre politique légale).
- Le service `auditService.archiveOldLogs` (`backend/src/services/auditService.js`) peut supprimer les entrées plus anciennes qu’un seuil — **planifier** un job (cron) en production si vous activez l’archivage automatique.

## Contenu d’une entrée

| Champ                              | Rôle                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| `userId`                           | Admin concerné (`ObjectId` User), ou `null` si login échoué                           |
| `action`                           | Ex. `login`, `logout`, `create-user`, `update-user`, `delete-user`, `admin-action`, … |
| `resource`                         | `user`, `restaurant`, `content`, `settings`, `auth`                                   |
| `resourceId`                       | Cible métier si applicable                                                            |
| `changes.before` / `changes.after` | Diff optionnelle (Mixed)                                                              |
| `ipAddress`, `userAgent`           | Contexte réseau                                                                       |
| `timestamp`                        | Date de l’événement                                                                   |
| `status`                           | `success` ou `failure`                                                                |
| `metadata`                         | Contexte additionnel (route, méthode HTTP, etc.)                                      |

## Index (performances)

Définis dans `AuditLog.js` :

- `userId` + `timestamp`
- `action` + `timestamp`
- `resource` + `resourceId` + `timestamp`
- `timestamp` (tri / export / purge)

## API dashboard (admin uniquement)

Routes sous le préfixe admin (auth JWT + rôle admin) — voir `backend/src/routes/admin.js` :

| Méthode | Path (relatif admin)       | Description                                                   |
| ------- | -------------------------- | ------------------------------------------------------------- |
| GET     | `/audit-logs`              | Liste paginée avec filtres (`userId`, `action`, `days`, etc.) |
| GET     | `/audit-logs/export`       | Export (format selon query)                                   |
| GET     | `/audit-logs/user/:userId` | Logs pour un utilisateur donné                                |

Le chemin complet HTTP suit le montage des routes admin (ex. `/api/v1/admin/...` selon votre configuration).

## Procédures opérationnelles

1. **Investigation** : filtrer par `userId`, `action`, plage de dates via l’API ou MongoDB Compass (`db.auditlogs.find(...)`).
2. **Export légal / conformité** : utiliser `/audit-logs/export` ou export Mongo chiffré hors prod.
3. **Accès** : restreindre aux comptes admin ; ne pas exposer ces endpoints publiquement.

## Code source

- Modèle : `backend/src/models/AuditLog.js`
- Service : `backend/src/services/auditService.js`
- Middleware contexte : `backend/src/middleware/auditLog.js`
- Tests : `backend/tests/unit/routes/audit-logs.test.js`

## Références

- [SECURITY-BEST-PRACTICES.md](./SECURITY-BEST-PRACTICES.md)
- [DOCUMENTATION-HUB.md](./DOCUMENTATION-HUB.md)
