/**
 * Échappe les caractères spéciaux d'une chaîne pour une utilisation sûre
 * dans une regex MongoDB ($regex), afin d'éviter les attaques ReDoS.
 * Limite aussi la longueur pour éviter les abus.
 */
const MAX_SEARCH_LENGTH = 100;

function escapeRegex(str) {
  if (str == null || typeof str !== 'string') {return '';}
  const trimmed = str.trim().slice(0, MAX_SEARCH_LENGTH);
  return trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Retourne une chaîne sûre pour $regex (échappée + longueur limitée).
 * À utiliser pour les paramètres de recherche (search, q, etc.).
 */
function safeRegexSearch(str) {
  return escapeRegex(str);
}

module.exports = { escapeRegex, safeRegexSearch, MAX_SEARCH_LENGTH };
