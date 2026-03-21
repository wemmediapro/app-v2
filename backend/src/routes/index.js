/**
 * Point d’entrée des routes API : monte toutes les routes sur l’app Express.
 * Versionnement : préfixe canonique `/api/v1` ; `/api` reste un alias (MVP / rétrocompatibilité).
 * @param {import('express').Application} app
 * @param {{ dbManager: { isConnected: () => boolean }, connectionCounters?: object, apiBases?: string[] }} deps
 */
function mountRoutes(app, deps = {}) {
  const { dbManager, connectionCounters, apiBases } = deps;
  const { API_BASE_PATHS } = require('../constants/apiVersion');
  const bases = Array.isArray(apiBases) && apiBases.length ? apiBases : API_BASE_PATHS;

  for (const base of bases) {
    mountRoutesAtBase(app, base, { dbManager, connectionCounters });
  }
}

/**
 * @param {import('express').Application} app
 * @param {string} base ex. /api/v1 ou /api
 */
function mountRoutesAtBase(app, base, { dbManager, connectionCounters }) {
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

  app.get(`${base}/health/ready`, (req, res) => {
    const dbConnected = dbManager && typeof dbManager.isConnected === 'function' && dbManager.isConnected();
    const body = {
      ready: dbConnected,
      mongodb: dbConnected ? 'connected' : 'disconnected',
      apiVersion: 'v1',
      timestamp: new Date().toISOString(),
    };
    if (dbConnected) {
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
