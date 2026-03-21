# Bonnes pratiques de sécurité (développement & production)

Synthèse pour les développeurs ; les procédures opérationnelles et checklists détaillées sont dans **[SECURITY.md](../SECURITY.md)** (racine) et **[backend/docs/SECURITY.md](../backend/docs/SECURITY.md)**.

## Authentification & secrets

- **JWT** : secret ≥ 32 caractères aléatoires, uniquement via variables d’environnement ; durées courtes + renouvellement côté dashboard si possible.
- **Cookies** : token en **httpOnly** ; en production, **secure** aligné sur HTTPS réel (`X-Forwarded-Proto` derrière proxy).
- **Admin** : pas d’identifiants de démo en prod ; `ADMIN_EMAIL` / `ADMIN_PASSWORD` obligatoires — voir `SECURITY.md`.
- **2FA** : activable pour les admins ; guides `docs/2FA-USER-GUIDE.md`, `docs/2FA-ADMIN-POLICIES.md`.

## Entrées utilisateur

- Valider avec **express-validator** et les helpers `validateInput.js` / `validation.js` ; préférer les validateurs réutilisables pour les IDs MongoDB (`isMongoId`, `validateMongoId`).
- Échapper les regex utilisateur pour les recherches (`safeRegexSearch` — éviter ReDoS).
- Limiter la taille du corps JSON : `express.json({ limit: '10mb' })` dans `server.js` — ajuster si besoin métier, sans ouvrir trop large.

## API surface

- **CORS** : `FRONTEND_URL` = liste d’origines explicites ; jamais `*` avec `credentials: true`.
- **Rate limiting** : login et API globale configurables ; ne pas activer les modes « load test » en production.
- **CSRF** : middleware dédié pour les scénarios concernés — voir implémentation dans `backend/src/middleware/csrf.js` et usages.

## Infrastructure

- MongoDB et Redis **non exposés** sur Internet ; authentification réseau + mots de passe forts.
- Terminaison **HTTPS** au proxy ; en-têtes de sécurité (voir correctifs production dans `docs/SECURITE-PRODUCTION-CORRECTIFS.md` si applicable).
- **Swagger** : désactivé en prod par défaut ; n’activer (`SWAGGER_ENABLED=true`) que si l’UI est protégée (VPN, auth basique, IP allowlist).

## Qualité & audit

```bash
cd backend
npm run audit:ci
npm run audit:security-credentials
```

Intégrer ces commandes dans la CI (déjà présent selon workflows du repo).

## Références rapides

| Sujet | Document |
|-------|----------|
| Validation détaillée | `backend/docs/VALIDATION.md` |
| Pistes de durcissement historiques | `docs/SECURITE-PRODUCTION-CORRECTIFS.md` |
| Schémas / contrats API | [API-SCHEMA.md](./API-SCHEMA.md), [OPENAPI.md](./OPENAPI.md) |
