/**
 * Point d’entrée des routes API : monte toutes les routes sur l’app Express.
 * Versionnement : préfixe canonique `/api/v1` ; `/api` reste un alias (MVP / rétrocompatibilité).
 * @param {import('express').Application} app
 * @param {{ dbManager: { isConnected: () => boolean }, connectionCounters?: object, apiBases?: string[], cacheManager?: { pingHealth?: () => Promise<{ ok: boolean, status: string }> } }} deps
 */
function mountRoutes(app, deps = {}) {
  const { dbManager, connectionCounters, apiBases, cacheManager } = deps;
  const { API_BASE_PATHS } = require('../constants/apiVersion');
  const bases = Array.isArray(apiBases) && apiBases.length ? apiBases : API_BASE_PATHS;

  for (const base of bases) {
    mountRoutesAtBase(app, base, { dbManager, connectionCounters, cacheManager });
  }
}

/**
 * @param {import('express').Application} app
 * @param {string} base ex. /api/v1 ou /api
 */
function mountRoutesAtBase(app, base, { dbManager, connectionCounters, cacheManager }) {
  const mediaLibraryRouter = require('./media-library');
  app.use(`${base}/media-library`, mediaLibraryRouter);
  app.use(`${base}/upload/media`, mediaLibraryRouter);

  app.use(`${base}/metrics`, require('./metrics'));
  app.use(`${base}/auth`, require('./auth'));
  app.use(`${base}/users`, require('./users'));
  app.use(`${base}/restaurants`, require('./restaurants'));
  app.use(`${base}/movies`, require('./movies'));
  app.use(`${base}/radio`, require('./radio'));
  app.use(`${base}/magazine`, require('./magazine'));
  app.use(`${base}/messages`, require('./messages'));
  app.use(`${base}/sync`, require('./sync'));
  app.use(`${base}/shop`, require('./shop'));
  app.use(`${base}/feedback`, require('./feedback'));
  app.use(`${base}/admin`, require('./admin'));
  app.use(`${base}/analytics`, require('./analytics'));
  app.use(`${base}/gnv`, require('./gnv'));
  app.use(`${base}/upload`, require('./upload'));
  app.use(`${base}/stream`, require('./stream'));
  app.use(`${base}/webtv`, require('./webtv'));
  app.use(`${base}/enfant`, require('./enfant'));
  app.use(`${base}/shipmap`, require('./shipmap'));
  app.use(`${base}/banners`, require('./banners'));
  app.use(`${base}/ads`, require('./ads'));
  app.use(`${base}/trailers`, require('./trailers'));
  app.use(`${base}/notifications`, require('./notifications'));
  app.use(`${base}/export`, require('./export'));

  const configModule = require('../config');
  /**
   * @swagger
   * /api/v1/health:
   *   get:
   *     summary: Vérification de l'état du serveur (liveness)
   *     description: Alias historique sans version — GET /api/health
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Serveur opérationnel
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Health'
   */
  app.get(`${base}/health`, async (req, res) => {
    const dbConnected = dbManager && typeof dbManager.isConnected === 'function' && dbManager.isConnected();
    let connections;
    if (connectionCounters && typeof connectionCounters.getTotalCountAsync === 'function') {
      try {
        connections = await connectionCounters.getTotalCountAsync();
      } catch (_) {
        connections = connectionCounters.getTotalCount ? connectionCounters.getTotalCount() : undefined;
      }
    } else if (connectionCounters && typeof connectionCounters.getTotalCount === 'function') {
      connections = connectionCounters.getTotalCount();
    }
    const payload = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      apiVersion: 'v1',
      mongodb:
        dbManager && typeof dbManager.isConnected === 'function'
          ? dbConnected
            ? 'connected'
            : 'disconnected'
          : 'unknown',
      offlineMode: !dbConnected,
      connections,
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    };
    if (dbConnected && dbManager.getStats) {
      const stats = dbManager.getStats();
      if (stats.name) {
        payload.mongodbDatabase = stats.name;
      }
    }
    if (configModule.env !== 'production') {
      payload.environment = configModule.env;
      if (configModule.mongodb && configModule.mongodb.dbName) {
        payload.mongodbDbName = configModule.mongodb.dbName;
      }
    }
    res.json(payload);
  });

  /**
   * @swagger
   * /api/v1/health/ready:
   *   get:
   *     summary: Readiness (MongoDB requis pour 200)
   *     description: Retourne 503 si la base n'est pas connectée — pour orchestrateurs (K8s, etc.).
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Prêt à recevoir du trafic
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 ready: { type: boolean, example: true }
   *                 mongodb: { type: string, example: 'connected' }
   *                 redis: { type: string, example: 'connected', description: 'connected|disconnected|error|skipped (dev sans Redis)' }
   *                 apiVersion: { type: string, example: 'v1' }
   *                 timestamp: { type: string, format: date-time }
   *       503:
   *         description: Base indisponible
   */
  app.get(`${base}/health/ready`, async (req, res) => {
    const dbConnected = dbManager && typeof dbManager.isConnected === 'function' && dbManager.isConnected();
    const isProd = process.env.NODE_ENV === 'production';

    let redis = { ok: true, status: 'skipped' };
    if (cacheManager && typeof cacheManager.pingHealth === 'function') {
      redis = await cacheManager.pingHealth();
    }

    const redisBlocksReady = isProd && !redis.ok;
    const ready = dbConnected && !redisBlocksReady;

    const body = {
      ready,
      mongodb: dbConnected ? 'connected' : 'disconnected',
      redis: redis.status,
      apiVersion: 'v1',
      timestamp: new Date().toISOString(),
    };
    if (ready) {
      return res.status(200).json(body);
    }
    return res.status(503).json(body);
  });

  /**
   * @swagger
   * /api/v1/time:
   *   get:
   *     summary: Heure serveur pour synchronisation
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Heure serveur
   */
  app.get(`${base}/time`, (req, res) => {
    const now = new Date();
    res.json({ serverTime: now.toISOString(), unix: now.getTime(), apiVersion: 'v1' });
  });
}

module.exports = { mountRoutes };
