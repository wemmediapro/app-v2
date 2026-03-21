# Postman, Insomnia, Bruno — importer l’API GNV

L’API est décrite en **OpenAPI 3** ; aucune collection maintenue à la main n’est obligatoire : importez la spec.

## 1. Obtenir le fichier OpenAPI

**Option A — fichier versionné (CI / hors ligne)**

```bash
cd backend
npm run openapi:json
```

Fichier généré : **`backend/docs/openapi.json`**.

**Option B — serveur qui tourne**

- Démarrer le backend (`npm run dev` ou équivalent dans `backend/`).
- Télécharger : `GET http://localhost:3000/api-docs.json`  
  (en production : uniquement si `SWAGGER_ENABLED=true` et accès contrôlé).

## 2. Postman

1. **Import** → **Upload Files** → choisir `openapi.json` (ou coller l’URL `.../api-docs.json`).
2. Postman crée une collection avec les paths documentés.
3. Créer un **Environment** :
   - `baseUrl` = `http://localhost:3000` (ou votre URL API).
   - Les chemins OpenAPI utilisent le préfixe **`/api/v1`** (voir [OPENAPI.md](./OPENAPI.md)).
4. **Auth** : pour les routes protégées, onglet **Authorization** de la collection ou de la requête → type **Bearer Token** → coller le JWT après login (`POST /api/v1/auth/login` ou équivalent).

## 3. Insomnia

1. **Application** → **Import/Export** → **Import Data** → **From File** → `openapi.json`.
2. Définir une **Environment** avec `base_url` si les requêtes utilisent des variables.
3. JWT : onglet **Auth** → **Bearer Token**.

## 4. Bruno / Hoppscotch / autre

Tout client compatible **OpenAPI 3** peut importer `openapi.json` ou l’URL `/api-docs.json`.

## 5. Limites actuelles

- Seules les routes avec annotation **`@swagger`** dans le code apparaissent dans la spec. Les autres endpoints existent mais ne sont pas encore dans le JSON — voir [API-SCHEMA.md](./API-SCHEMA.md) pour étendre la doc.
- L’alias **`/api/...`** (sans `v1`) est équivalent à **`/api/v1/...`** ; la spec ne duplique pas les paths pour éviter les doublons.

## Références

- [OPENAPI.md](./OPENAPI.md) — Swagger UI, variables `API_BASE_URL`, `SWAGGER_ENABLED`
- [DOCUMENTATION-HUB.md](./DOCUMENTATION-HUB.md) — index global
