# OpenAPI / Swagger

## Accès

| Ressource      | URL (dev)                             | Condition                                             |
| -------------- | ------------------------------------- | ----------------------------------------------------- |
| **Swagger UI** | `http://localhost:3000/api-docs`      | Toujours en développement (`NODE_ENV !== production`) |
|                |                                       | En production : définir `SWAGGER_ENABLED=true`        |
| **Spec JSON**  | `http://localhost:3000/api-docs.json` | Idem                                                  |

Variable optionnelle : `API_BASE_URL` — utilisée dans le champ `servers` de la spec (clients générateurs, Postman).

## Préfixe canonique

Les routes sont documentées sous **`/api/v1/...`**. Le même routeur est aussi monté sous **`/api/...`** (alias) : les deux chemins répondent de la même façon ; seul `/api/v1` apparaît dans OpenAPI pour éviter les doublons.

## Étendre la documentation

1. Dans le fichier de route concerné (`backend/src/routes/*.js`), ajouter un bloc JSDoc **`@swagger`** au-dessus du handler (voir exemples dans `auth.js`, `restaurants.js`, `index.js`).
2. Réutiliser les schémas dans `backend/src/lib/swagger.js` (`components.schemas`) via `$ref: '#/components/schemas/NomSchema'`.
3. Regénérer le fichier statique si besoin :

```bash
cd backend
npm run openapi:json
```

Le fichier produit est **`backend/docs/openapi.json`** (pratique pour CI, import Insomnia, génération de clients).

## Fichiers clés

| Fichier                             | Rôle                                                             |
| ----------------------------------- | ---------------------------------------------------------------- |
| `backend/src/lib/swagger.js`        | Métadonnées OpenAPI, schémas partagés, chemins des sources jsdoc |
| `backend/server.js`                 | Montage de `swagger-ui-express` et route `GET /api-docs.json`    |
| `backend/scripts/export-openapi.js` | Export JSON                                                      |

Pour une vue d’ensemble **schémas métier vs OpenAPI**, voir [API-SCHEMA.md](./API-SCHEMA.md).

## Couverture des endpoints

Toutes les routes Express ne sont pas encore annotées avec `@swagger` : la spec décrit **un sous-ensemble** qui grandit au fil des PR. Les routes non listées restent utilisables ; pour l’intégration, compléter la doc ou consulter le code dans `backend/src/routes/`.

**Import Postman / Insomnia** : [POSTMAN-INSOMNIA.md](./POSTMAN-INSOMNIA.md).
