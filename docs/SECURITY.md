# Sécurité et audit npm

## Audit des dépendances

- **`npm run audit`** — affiche toutes les vulnérabilités (exit 1 si au moins une).
- **`npm run audit:ci`** — échoue uniquement pour **moderate** et au-dessus (low ignoré, utile en CI).

## Objectif : 0 vulnérabilité

Le package **pm2** a été retiré des devDependencies (ReDoS, aucune version corrigée). Pour la production : **Node** (`node backend/server.production.js`), **systemd**, **Docker**, ou réinstaller pm2 quand une version corrigée existera (`npm install -g pm2`).
