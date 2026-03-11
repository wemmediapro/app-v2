/**
 * Audit complet style OpenIA : ergonomie, navigation, architecture, fonctionnalités.
 * Utilise l'API OpenAI pour produire un rapport structuré dans docs/.
 *
 * Usage: cd backend && node scripts/audit-complet-openia.js
 * Prérequis: OPENAI_API_KEY dans backend/config.env ou .env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai').default;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ROOT = path.join(__dirname, '..', '..');

const AUDIT_CONTEXT = `
# Contexte pour audit complet — GNV OnBoard

## 1. ARCHITECTURE

### Backend (Node.js, Express, port 3000)
- **Base** : Express, MongoDB (Mongoose), Socket.io, Redis (adapter Socket), JWT (auth).
- **Routes API montées** (préfixe /api) :
  - auth (login, register, logout, refresh, me, profile)
  - users, admin (dashboard, users, conversations, cache/clear)
  - restaurants, movies, radio, magazine, webtv, shop, enfant, shipmap, banners, trailers
  - notifications (GET public, POST/DELETE admin), export/snapshot
  - messages (conversations, messages par userId), feedback
  - analytics (overview, connections, content, performance)
  - gnv/ships, upload (video, image, audio, media, image-from-base64), stream/video
  - media-library
- **Auth** : JWT (Bearer), authMiddleware, adminMiddleware ; tokens en localStorage côté client.
- **Socket.io** : rooms, send-message / new-message ; auth par token.
- **Données** : MongoDB (gnv_onboard) ; fallbacks JSON pour offline ; PWA avec Workbox (cache API 200, médias).

### Frontend — App passagers (Vite, React, port 5173)
- **Structure** : src/App.jsx (très volumineux, état central), src/main.jsx, src/services/apiService.js, src/contexts/LanguageContext, src/locales (fr, en, es, it, de, ar).
- **Navigation** : état \`page\` (home, profile, notifications, favorites, shop, radio, movies, webtv, magazine, restaurant, enfant, shipmap, signup, etc.) ; pas de React Router pour l'app principale ; barre du bas (Accueil, Profil, Notifications, Favoris) si connecté.
- **Pages / zones** : Accueil (bannières, grille d'icônes), Films & Séries, Radio, WebTV, Magazine, Restaurants, Espace Enfant, Plan du navire (shipmap), Shop, Favoris, Profil, Inscription, Notifications.
- **UI** : Tailwind, Framer Motion, Lucide, PWA (vite-plugin-pwa), multi-langue.

### Frontend — Dashboard admin (Vite, React, sous /dashboard/)
- **Structure** : dashboard/src/ (App, pages Dashboard, Notifications, Settings, etc., components Sidebar, Header), React Router.
- **Navigation** : Sidebar fixe (w-64) avec groupes (Vue d'ensemble, Média, Services, Communauté) ; Header (recherche, langue, notifications, profil).
- **Pages** : Login, Dashboard (stats, graphiques Recharts, envoi notification push), Radio, Movies, WebTV, Magazine, Restaurants, Shop, Enfant, Banners, ShipMap, Users, Notifications (liste + envoi), Settings (accès par rôle), Analytics.

### Design system (docs/DESIGN-SYSTEM.md)
- Couleurs : primaire #264FFF / blue-600, texte slate/gray, sémantique green/red/amber/blue.
- Typo : titres text-2xl/3xl font-bold, corps text-sm/base.
- Espacements : multiples de 4px, padding cartes p-4 à p-6.
- Composants : boutons (primaire dégradé, secondaire bordure), cartes (rounded-xl, shadow-sm), champs (rounded-xl, focus:ring).
- Accessibilité : aria-label sur boutons icône, cibles tactiles ≥ 44px.

---

## 2. NAVIGATION

### App passagers
- Entrée : grille d'icônes sur l'accueil (Ship, Radio, Clapperboard, Tv, BookOpen, Utensils, Baby, Map, ShoppingBag…) → changement de \`page\`.
- Barre du bas (si connecté) : Home, Profil, Notifications (badge si non lus), Favoris.
- Pas d'URL par section (SPA mono-page état) ; deep linking limité.
- Sélecteur de langue : 6 langues (fr, en, es, it, de, ar).

### Dashboard
- Sidebar : liens par section (Dashboard, Analytics, Radio, Movies, WebTV, Bibliothèque, Magazine, Restaurants, Shop, Shipmap, Enfant, Banners, Users, Notifications, Settings).
- Header : recherche globale, langue, cloche notifications, profil, déconnexion.
- Routes React Router : /dashboard, /messages, /settings, etc.

---

## 3. FONCTIONNALITÉS PRINCIPALES

- **Contenu** : Films/séries (posters, filtres, lecteur), Radio (stations, lecteur, listeners), WebTV (chaînes, programme), Magazine (articles, catégories), Restaurants (menus, plats), Shop (produits, panier, promotions), Espace Enfant (activités), Plan du navire (decks, zones).
- **Utilisateur** : Inscription, profil (prénom, nom, pays, cabine, etc.), favoris agrégés, notifications push (liste, marquage lu).
- **Admin** : CRUD sur tous les contenus, envoi notifications push, utilisateurs, feedback, analytics, paramètres d'accès par rôle.
- **Technique** : PWA offline, multi-langue, Socket.io (messagerie / temps réel), export snapshot (optionnel protégé par clé).

---

## 4. POINTS DÉJÀ DOCUMENTÉS (audits précédents)

- Sécurité : ANALYSE-OPENIA.md, AUDIT-COMPLET-SECURITE-OPENIA.md (secrets, JWT, CORS, rate limit, etc.).
- Ergonomie / graphisme : ANALYSE-GRAPHIQUE-ERGONOMIE-OPENAI.md (synthèse, recommandations couleurs/typo/accessibilité, quick wins).
- Design system : DESIGN-SYSTEM.md (palette, typo, espacements, composants, accessibilité).
`;

const SYSTEM_PROMPT = `Tu es un expert en audit d'applications web (UX, architecture logicielle, product). Tu réalises des audits complets dans l'esprit "OpenIA" : structurés, factuels, actionnables, avec niveaux de priorité.

Tu dois répondre en français. Utilise uniquement les informations fournies (pas d'invention). Structure ta réponse en Markdown avec des titres et sous-titres clairs.`;

const USER_PROMPT = `Réalise un **audit complet** de l'application GNV OnBoard à partir du contexte fourni. Le rapport doit couvrir les quatre axes suivants, avec pour chacun une synthèse, des points forts, des points faibles et des recommandations priorisées (court / moyen / long terme).

## 1. ERGONOMIE (UX/UI)
- Cohérence visuelle entre app passagers et dashboard (design system, couleurs, typo).
- Lisibilité, hiérarchie visuelle, densité d'information.
- Accessibilité (contraste, cibles tactiles, ARIA, clavier).
- Feedback utilisateur (chargement, erreur, succès), parcours et charge cognitive.

## 2. NAVIGATION
- Clarté et découverte des sections (app passagers : grille accueil, barre du bas ; dashboard : sidebar).
- Deep linking / URLs (absence de routes par section côté passagers).
- Cohérence des menus et fil d'Ariane si pertinent.
- Points de sortie et retour (back, breadcrumb).

## 3. ARCHITECTURE
- Organisation backend (routes, séparation des responsabilités, auth).
- Organisation frontend (monolithe App.jsx vs modules, partage d'état, apiService).
- Flux de données (API, cache, offline, Socket.io).
- Maintenabilité, évolutivité, dette technique potentielle.

## 4. FONCTIONNALITÉS
- Couverture des cas d'usage (passager vs admin).
- Complétude des parcours (inscription, profil, contenus, notifications, messagerie).
- Lacunes ou incohérences (ex. export snapshot, permissions, rôles).
- Recommandations de fonctionnalités manquantes ou à renforcer.

En fin de rapport, ajoute une **synthèse exécutive** (une page max) avec les 5 à 10 actions les plus impactantes, par ordre de priorité, et une **liste d'améliorations priorisées** (tableau : axe, recommandation, priorité, effort estimé court/moyen/long).`;

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant. Définissez-le dans backend/config.env ou .env');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const outputPath = path.join(ROOT, 'docs', 'AUDIT-COMPLET-ERGONOMIE-NAVIGATION-ARCHITECTURE-FONCTIONNALITES-OPENIA.md');

  console.log('Envoi du contexte à OpenAI pour audit complet (ergonomie, navigation, architecture, fonctionnalités)...');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${USER_PROMPT}\n\n---\n\n${AUDIT_CONTEXT}` }
    ],
    max_tokens: 8192,
    temperature: 0.3
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    console.error('Aucune réponse reçue d\'OpenAI.');
    process.exit(1);
  }

  const fullReport = `# Audit complet — Ergonomie, Navigation, Architecture, Fonctionnalités — GNV OnBoard\n\n**Généré par OpenAI (style OpenIA)** — ${new Date().toISOString().slice(0, 10)}\n\n---\n\n${content}`;

  const docsDir = path.dirname(outputPath);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, fullReport, 'utf8');
  console.log('Rapport écrit :', outputPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
