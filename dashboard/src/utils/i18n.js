/**
 * Constantes partagées pour le contenu multilingue (dashboard).
 * Même liste de langues que "Nouvel article" — une seule source à modifier pour ajouter une langue.
 * Utilisé par Magazine, Shop, Banners, Movies, Radio, WebTV, Enfant, Restaurants, Shipmap.
 */
export const LANG_LIST = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'de', label: 'Deutsch' },
];

/** Pour formulaires où le français est dans les champs principaux (title, description) et les autres langues dans translations */
export function emptyTranslations() {
  return { en: {}, es: {}, it: {}, de: {} };
}

/** Pour formulaires où toutes les langues (y compris fr) sont dans l'objet translations */
export function emptyTranslationsAll() {
  return LANG_LIST.reduce((acc, { code }) => ({ ...acc, [code]: {} }), {});
}

/** Pour chaque plat du menu : name/description par langue */
export function emptyMenuTranslations() {
  return LANG_LIST.reduce((acc, { code }) => ({ ...acc, [code]: { name: '', description: '' } }), {});
}

/** Pour chaque promotion : title/description par langue */
export function emptyPromotionTranslations() {
  return LANG_LIST.reduce((acc, { code }) => ({ ...acc, [code]: { title: '', description: '' } }), {});
}
