/**
 * Configuration MongoDB (pool, timeouts) — alignement audit prod ~1500 utilisateurs.
 *
 * Les options sont appliquées à la connexion dans {@link ../lib/database-optimized.js} via
 * `buildMongoPoolOptions()` (défaut maxPoolSize 30, minPoolSize 10 ; surcharge env).
 */
const { buildMongoPoolOptions, MONGO_POOL_THRESHOLDS } = require('../lib/mongoose-connection');

/**
 * @returns {Record<string, unknown>} Aperçu des options utiles pour la doc / health (pas nécessairement exhaustif).
 */
function getConnectionOptionsSnapshot() {
  const pool = buildMongoPoolOptions();
  return {
    maxPoolSize: pool.maxPoolSize,
    minPoolSize: pool.minPoolSize,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 10000,
    heartbeatFrequencyMS: 10000,
    retryWrites: true,
    readPreference: 'secondaryPreferred',
    monitorCommands: process.env.NODE_ENV === 'development',
  };
}

module.exports = {
  buildMongoPoolOptions,
  getConnectionOptionsSnapshot,
  MONGO_POOL_THRESHOLDS,
};
