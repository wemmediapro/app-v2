# Points à vérifier / À faire

## 5. Aligner versions packages ✅

- **Frontend (racine)** : React 18.3.1, tailwindcss ^3.4.0, vite ^7.1.10, framer-motion ^11.0.0, lucide-react ^0.378.0.
- **Dashboard** : Aligné sur frontend (framer-motion ^11, lucide-react ^0.378, tailwindcss ^3.4.0, vite ^5.4.0, @vitejs/plugin-react ^4.3.4).
- **Backend** : express ^5.1.0, multer ^2.0.0.

---

## 6. Classes Tailwind dynamiques

- Les classes sont construites avec des template literals (ex. `` `${isActive ? 'bg-blue-600' : 'bg-slate-100'}` ``). Tailwind 3 (JIT) scanne les fichiers et ne garde que les classes dont la chaîne complète apparaît dans le code.
- **État** : Les classes utilisées sont des chaînes complètes (pas de concaténation de fragments comme `bg-${color}`), donc le purge fonctionne correctement.
- **À surveiller** : Si vous ajoutez des classes dynamiques du type `rounded-${size}`, les ajouter dans `tailwind.config.js` sous `safelist` si nécessaire.

---

## 9. Migrer multer v2.x ✅

- **Fait** : Backend utilise `multer ^2.0.0`. API diskStorage / fileFilter inchangée ; routes d’upload non modifiées.

---

## 10. Migrer express v5.x ✅

- **Fait** : Backend utilise `express ^5.1.0`. Aucun `res.sendfile`, `app.del` ou `req.param()` dans le code ; démarrage vérifié.

---

## 13–17. Nettoyage (fichiers, tunnels, SQLite, tests)

- **Tunnels** : Documenté dans `scripts/tunnels/README.md` (ngrok, localtunnel, Cloudflare). Supprimer les scripts inutilisés si besoin.
- **SQLite** : `better-sqlite3` est en devDependencies backend mais n’est pas `require()` dans le code ; retirable avec `npm uninstall better-sqlite3` si inutile.
- **Tests** : `npm run test` (Vitest) et `npm run test:e2e` (Playwright) configurés ; la CI exécute les tests unitaires. Couverture et e2e à renforcer si besoin.

---

## Réalisé

- **7. aria-label** : Clés i18n dans toutes les locales (app + dashboard). Boutons dans `src/` et `dashboard/src` utilisent `t()` (close, menu, openMenu, closeMenu, playVideo, breadcrumb, loginForm, etc.).
- **8. Textes en dur** : Traités pour les aria-labels ; autres chaînes à remplacer par `t()` au fil de l’eau.
- **11. CI/CD** : Workflow `.github/workflows/ci.yml` (frontend : install, test, build, audit ; backend : install, audit).
- **12. Data navires** : Source unique `data/ships.json` ; `src/data/ships.js` et `dashboard/src/data/ships.js` l’importent.
- **5. Versions** : Dashboard aligné (framer-motion 11, lucide-react 0.378, tailwind 3.4) ; backend express 5.1, multer 2.
- **9–10. Backend** : Multer 2.x et Express 5.x en place, compatibilité vérifiée.
- **13–17** : Tunnels documentés (`scripts/tunnels/README.md`) ; SQLite et tests notés dans ce doc.
