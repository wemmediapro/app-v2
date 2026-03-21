/**
 * Versionnement REST : préfixe canonique /api/v1 ; /api/* reste un alias (rétrocompatibilité).
 */
const API_VERSION = 'v1';

/** Bases montées dans l’ordre (même routeur enregistré sur chaque base). */
const API_BASE_PATHS = [`/api/${API_VERSION}`, '/api'];

module.exports = { API_VERSION, API_BASE_PATHS };
