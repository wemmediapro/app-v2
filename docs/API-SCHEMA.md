# Documentation des schémas API

Ce projet combine **Mongoose (MongoDB)** pour la persistance et **OpenAPI 3** pour décrire les contrats HTTP exposés aux clients.

## Où sont les « vrais » schémas ?

| Source | Emplacement | Rôle |
|--------|-------------|------|
| Modèles Mongoose | `backend/src/models/*.js`, `backend/models/*.js` | Schéma de données en base, hooks (hash mot de passe), index |
| Validation requêtes | `backend/src/middleware/validation.js`, `validateInput.js` | Règles express-validator sur body/query/params |
| Schémas OpenAPI | `backend/src/lib/swagger.js` → `components.schemas` | Types documentés pour clients / Swagger UI |
| Annotations de routes | Blocs `@swagger` dans `backend/src/routes/*.js` | Paths, paramètres, réponses, sécurité |

**Important** : l’API REST utilise **Mongoose**, pas Prisma, pour les routes métier — voir `docs/BACKEND-PRISMA.md`.

## Cohérence OpenAPI ↔ code

- Les schémas OpenAPI (`User`, `Health`, `Restaurant`, `Movie`, etc.) sont des **sous-ensembles** utiles à la doc ; ils ne remplacent pas les modèles Mongoose.
- Lorsqu’un champ est ajouté à une réponse JSON, mettre à jour **le modèle** et, si le champ est public/contrat stable, le **schéma OpenAPI** ou l’inline du `@swagger` correspondant.
- Les erreurs typiques peuvent référencer `#/components/schemas/Error` dans les réponses documentées.

## Versionnement des URLs

- Préfixe canonique : **`/api/v1`** (voir `backend/src/constants/apiVersion.js`).
- Alias : **`/api`** (même handlers).
- La spec OpenAPI documente **`/api/v1/...`** — voir [OPENAPI.md](./OPENAPI.md).

## Export machine-readable

Pour générer un client ou valider la spec :

```bash
cd backend
npm run openapi:json
```

Fichier : `backend/docs/openapi.json`.

## Lectures complémentaires

- [OPENAPI.md](./OPENAPI.md) — UI Swagger, extension de la doc  
- [backend/docs/VALIDATION.md](../backend/docs/VALIDATION.md) — validation des entrées  
- [SECURITY-BEST-PRACTICES.md](./SECURITY-BEST-PRACTICES.md) — exposition API et durcissement  
