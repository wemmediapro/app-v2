# Sécurité et audit npm

## Audit des dépendances

- **`npm run audit`** — affiche toutes les vulnérabilités (exit 1 si au moins une).
- **`npm run audit:ci`** — échoue uniquement pour **moderate** et au-dessus (low ignoré, utile en CI).

## Vulnérabilité connue (pm2)

- **Package** : `pm2` (devDependency)
- **Gravité** : faible (ReDoS — [GHSA-x5gf-qvw8-r2rm](https://github.com/advisories/GHSA-x5gf-qvw8-r2rm))
- **Correctif** : aucun correctif publié à ce jour.

pm2 est utilisé uniquement pour lancer les processus en production (backend, frontend, dashboard). Il n’est pas exposé directement aux requêtes HTTP. Le risque reste limité en usage normal.

Mettre à jour pm2 dès qu’une version corrigée sera disponible : `npm update pm2` puis `npm audit`.
