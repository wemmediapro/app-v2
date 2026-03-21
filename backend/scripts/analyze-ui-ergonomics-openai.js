/**
 * Analyse graphique et ergonomique de toutes les pages (app passagers + dashboard admin)
 * via l'API OpenAI. Génère un rapport dans docs/ANALYSE-GRAPHIQUE-ERGONOMIE-OPENAI.md
 *
 * Usage: cd backend && node scripts/analyze-ui-ergonomics-openai.js
 * Prérequis: OPENAI_API_KEY dans backend/.env ou config.env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai').default;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const PAGES_DESCRIPTION = `
# Application GNV OnBoard — Inventaire des pages

## Contexte
- **App passagers (tablette)** : React (Vite), Framer Motion, Lucide, Tailwind. PWA offline. Multi-langue (fr, en, es, it, de, ar). Utilisée par les passagers à bord.
- **Dashboard admin** : React (Vite), Framer Motion, Lucide, Recharts, Tailwind. Sidebar fixe 64 (w-64), header avec recherche/langue/notifications, zone main avec padding. Utilisée par l'équipe à terre ou à bord.

---

## 1. App passagers (tablette / web)

### Accueil (home)
- Bannières full-width (image mobile / tablette / desktop selon largeur), carousel.
- Navigation : grille d'icônes (Ship, Radio, Clapperboard, Tv, BookOpen, Utensils, Baby, Map, ShoppingBag, etc.) vers les sections.
- Indication hors ligne possible ; sélecteur de langue (dropdown avec drapeaux).
- Fond sombre ou dégradé selon thème ; contenu centré.

### Films & Séries (movies)
- Liste de cartes (poster, titre, genre, durée, type film/série).
- Filtres : genre, année, type (film/série), notation.
- Lecteur vidéo en modal ou plein écran ; barre de progression, reprise.
- Favoris / liste de visionnage.

### Radio
- Liste de stations avec logo, nom ; lecteur audio (play/pause, volume, shuffle, repeat).
- Playlist locale pour mode offline.

### WebTV
- Chaînes en grille ; lecteur vidéo intégré.

### Magazine
- Articles par catégorie ; cartes avec image, titre, extrait.
- Recherche, favoris (coeur), détail article en modal ou page.

### Restaurants
- Liste des restaurants du bord ; détail (menu, plats, images).
- Cartes avec image, nom, horaires.

### Espace Enfant (enfant)
- Activités pour enfants par catégorie (Jeux, Arts, Sport, etc.).
- Cartes illustrées, contenu adapté.

### Plan du navire (shipmap)
- Plan interactif (decks, zones) ; zoom, navigation entre ponts.
- Points d'intérêt, légende.

### Shop
- Produits en grille (image, nom, prix) ; panier, détails.

### Favoris
- Agrégation des favoris (films, magazine, etc.).

### Profil
- Formulaire (prénom, nom, pays, date de naissance, téléphone, cabine, email).
- Déconnexion.

### Inscription (signup)
- Étapes : profil puis consentements.
- Champs similaires au profil + consentements (promo, analyse, règles).

### Notifications
- Liste des notifications push (titre, message, date) ; marquage lu.

### Éléments communs app passagers
- Barre de navigation basse ou latérale avec icônes.
- LanguageSelector : bouton drapeau + menu déroulant (fixed), 6 langues.
- Modales (lecteur vidéo, détail film, etc.) ; animations Framer Motion.
- Couleurs : bleu/cyan (accents), fonds sombres ou dégradés, texte clair sur fond sombre.

---

## 2. Dashboard admin

### Login
- Plein écran, fond dégradé (blue-50, cyan-50, teal-50).
- Carte centrée : logo GNV (Ship dans cercle bleu-cyan), titre "GNV Dashboard", sous-titre "Connexion administrateur".
- Formulaire : email, mot de passe (avec bouton afficher/masquer), bouton "Se connecter" (dégradé blue-600 → cyan-600).
- Encadré "Identifiants de démonstration" (admin@gnv.com / Admin123!).
- Animations motion (opacity, y).

### Dashboard (tableau de bord)
- Titre "Tableau de bord", sous-titre.
- Grille de cartes statistiques (Users, Viewers, Restaurants, Radio, Movies, Magazine, Enfant, Shop, Messages, Feedback) avec icône colorée, valeur, tendance (+X%, -X%).
- Deux graphiques : BarChart (feedback par statut), PieChart (utilisateurs par rôle) — Recharts.
- Blocs "Récents utilisateurs" et "Récents feedback" en listes.
- Section "Envoyer une notification push" : formulaire (titre, message, type), liste des notifications récentes.
- Couleurs : white cards, border gray-200, blue/violet/green/cyan/purple/indigo/pink/amber pour les icônes.

### Sidebar
- Fixe à gauche (w-64), fond blanc, bordure droite grise.
- Logo + "GNV Dashboard" + "Administration".
- Groupes : Vue d'ensemble (Dashboard, Analytics), Média (Radio, Movies, WebTV, Bibliothèque, Magazine), Services (Restaurants, Shop, Shipmap, Enfant, Banners), Communauté (Users, Notifications, Settings).
- Élément actif : bg-blue-50, text-blue-700, border-r-2 border-blue-600.
- Scroll si contenu long.

### Header
- Fond blanc, shadow-sm, bordure basse.
- Champ recherche (icône Search à gauche), LanguageSelector, bouton notifications (icône Bell + badge 3), profil utilisateur (nom, "Administrateur", avatar dégradé blue→purple), bouton déconnexion (LogOut).

### Pages de gestion (Movies, Magazine, WebTV, Radio, Restaurants, Shop, Enfant, Banners, ShipMap, etc.)
- Titre de page, parfois sous-titre.
- Filtres (FilterBar : recherche, filtres par type/pays/destination).
- Tableaux ou grilles de contenus (cartes avec image, titre, actions Edit/Delete).
- Modales d'ajout/édition (formulaires avec champs, upload image/vidéo, onglets langues pour traductions).
- Boutons "Ajouter" (Plus), sauvegarder, annuler.
- Pagination ou liste infinie selon la page.
- Toasts (react-hot-toast) pour succès/erreur.

### Bibliothèque / Library
- Gestion des médias (fichiers uploadés) pour association aux contenus.

### Users
- Liste des utilisateurs (rôle, email, etc.) ; gestion des accès par module (Settings).

### Messages (Notifications)
- Liste des notifications envoyées ; possiblement formulaire d'envoi.

### Settings
- Paramètres par rôle (admin, crew, passenger) : cases à cocher par module pour accès.
- Sauvegarde dans localStorage (dashboardAccessByRole).
- Autres réglages (base de données, cache, etc.).

### Analytics
- Graphiques et statistiques avancées.

### Destinations / Bateaux
- Pages de référence (destinations, bateaux) si présentes.

---

## 3. Points techniques communs
- Tailwind CSS pour tout le style.
- Framer Motion pour transitions et animations (initial, animate, whileHover, whileTap).
- Lucide React pour les icônes.
- Pas de design system documenté ; couleurs et espacements varient (blue-500, blue-600, cyan-600, gray-50 à gray-900, etc.).
- Formulaires : inputs avec border gray-300, focus:ring-2 focus:ring-blue-500.
- Boutons primaires : souvent dégradé blue-600 → cyan-600 ou bleu plein.
- Cartes : bg-white, rounded-xl, shadow-sm, border border-gray-200.
`;

const SYSTEM_PROMPT = `Tu es un expert en design d'interface (UI) et en ergonomie (UX). Tu analyses des applications web et mobiles pour proposer des améliorations concrètes, priorisées et réalisables.

Tu dois répondre en français. Structure ta réponse en Markdown avec des titres et sous-titres clairs.`;

const USER_PROMPT = `À partir de la description suivante de toutes les pages de l'application GNV OnBoard (app passagers tablette + dashboard admin), réalise une **analyse graphique et ergonomique** complète et propose des **améliorations** concrètes.

À faire :
1. **Synthèse globale** : cohérence visuelle entre app passagers et dashboard, points forts et faiblesses.
2. **Analyse par zone** :
   - App passagers : navigation, lisibilité, hiérarchie visuelle, accessibilité (contraste, touch targets, clavier), feedback utilisateur, états de chargement et d'erreur.
   - Dashboard admin : clarté des tableaux de bord, densité d'information, formulaires et modales, réutilisation des composants.
3. **Recommandations graphiques** : palette de couleurs, typographie, espacements, composants réutilisables (design system), responsive.
4. **Recommandations ergonomiques** : parcours utilisateur, réduction de la charge cognitive, messages d'erreur et de succès, accessibilité (ARIA, focus, contraste).
5. **Liste d'améliorations priorisées** : court terme (quick wins), moyen terme, long terme ; pour chaque item, indiquer la page(s) concernée(s) et une suggestion concise.

Base ton analyse uniquement sur la description fournie (pas d'invention de pages). Sois précis et actionnable.`;

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant. Définissez-le dans backend/.env ou config.env');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const outputPath = path.join(__dirname, '..', '..', 'docs', 'ANALYSE-GRAPHIQUE-ERGONOMIE-OPENAI.md');

  console.log('Envoi de la description des pages à OpenAI pour analyse graphique et ergonomique...');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${USER_PROMPT}\n\n---\n\n${PAGES_DESCRIPTION}` },
    ],
    max_tokens: 4096,
    temperature: 0.4,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    console.error('Aucune réponse reçue d\'OpenAI.');
    process.exit(1);
  }

  const fullReport = `# Analyse graphique et ergonomique — GNV OnBoard\n\n**Généré par OpenAI** à partir de l'inventaire des pages (app passagers + dashboard admin).\n\n---\n\n${content}`;

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
