# Scripts réservés au développement

Les scripts suivants **ne doivent pas** être exécutés en production (build/deploy). Ils sont exclus du démarrage serveur (`npm start` = `node server.js`).

- **OpenAI / audit** : `audit-complet-openia.js`, `analyze:ui`, `apply:improvements`
- **Seeds OpenAI** : `seed:magazine-openai`, `seed:*openai*`, `seed:*translations-openai`, etc.
- **Seeds données** : `seed:radio`, `seed:magazine-*`, `seed:restaurant-*`, `seed:shop-*`, `seed:movies-*`, `seed:enfant-*`, `seed:shipmap-*`, `seed:promo-*`, `init-admin`, `init-db`

En production : ne lancer que `npm start` (ou `node server.js`). Les scripts ci-dessus contiennent un garde `NODE_ENV === 'production'` → `process.exit(1)` lorsqu’ils sont appelés en prod.
