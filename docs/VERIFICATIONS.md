# Points à vérifier / À faire

## 5. Aligner versions packages

- **Frontend (racine)** : React 18.3.1, axios ^1.6.0, tailwindcss ^3.4.0, vite ^7.1.10, framer-motion ^11.0.0, lucide-react ^0.378.0.
- **Dashboard** : React 18.3.1, axios ^1.6.2, tailwindcss ^3.3.6, vite ^5.0.8, framer-motion ^10.16.16, lucide-react ^0.294.0.
- **Backend** : express ^4.18.2, multer ^1.4.5-lts.1.

**Recommandations** : Aligner framer-motion et lucide-react entre frontend et dashboard ; garder les versions majeures cohérentes (ex. tailwind 3.x partout). Vérifier que `npm install` et les builds passent après alignement.

---

## 6. Classes Tailwind dynamiques

- Les classes sont construites avec des template literals (ex. `` `${isActive ? 'bg-blue-600' : 'bg-slate-100'}` ``). Tailwind 3 (JIT) scanne les fichiers et ne garde que les classes dont la chaîne complète apparaît dans le code.
- **État** : Les classes utilisées sont des chaînes complètes (pas de concaténation de fragments comme `bg-${color}`), donc le purge fonctionne correctement.
- **À surveiller** : Si vous ajoutez des classes dynamiques du type `rounded-${size}`, les ajouter dans `tailwind.config.js` sous `safelist` si nécessaire.

---

## 9. Migrer multer v2.x

- **Actuel** : `multer ^1.4.5-lts.1` (backend).
- **État** : Multer 2.x est stable (v2.1.x en 2025), avec correctifs de sécurité (CVE). Migration 1.x → 2.x décrite comme simple.
- **À faire** : `cd backend && npm install multer@^2` puis exécuter les tests et les routes d’upload ; adapter si l’API a changé (voir [releases multer](https://github.com/expressjs/multer/releases)).

---

## 10. Migrer express v5.x

- **Actuel** : `express ^4.18.2` (backend).
- **État** : Express 5.1.0 est la version `latest` sur npm (depuis mars 2025). Breaking changes : `res.sendfile` → `res.sendFile`, `app.del` → `app.delete`, `req.param()` retiré, etc.
- **À faire** : Suivre le [guide de migration Express 5](https://expressjs.com/en/guide/migrating-5) et éventuellement les codemods :  
  `npx codemod@latest @expressjs/v5-migration-recipe`

---

## 13–17. Nettoyage (fichiers, tunnels, SQLite, tests)

- **Tunnels** : Plusieurs scripts dans `scripts/tunnels/` (ngrok, localtunnel, Cloudflare). Garder ceux utilisés en dev/démo, supprimer ou documenter les autres.
- **SQLite** : `better-sqlite3` présent en devDependencies backend ; vérifier s’il est encore utilisé (scripts, tests) ou peut être retiré.
- **Tests** : `npm run test` (Vitest) et `npm run test:e2e` (Playwright) configurés ; la CI exécute déjà les tests unitaires. Vérifier la couverture et les tests e2e si besoin.

---

## Réalisé dans cette session

- **7. aria-label** : Clés i18n ajoutées (`common.menu`, `common.close`, `common.playVideo`, etc.) et boutons concernés dans `src/` mis à jour pour utiliser `t()`.
- **8. Textes en dur** : Partiellement traité via les aria-labels ; les autres chaînes en dur (anglais/français) restent à repérer et remplacer par `t()`.
- **11. CI/CD** : Workflow `.github/workflows/ci.yml` ajouté (frontend : install, test, build, audit ; backend : install, audit).
- **12. Data navires** : Fichier central `data/ships.json` créé ; `src/data/ships.js` et `dashboard/src/data/ships.js` l’utilisent comme source unique.
