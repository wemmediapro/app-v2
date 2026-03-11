/**
 * Point d'entrée de la connexion MongoDB.
 * Délègue au gestionnaire optimisé (pool, reconnexion, etc.)
 */
module.exports = require('./database-optimized');
