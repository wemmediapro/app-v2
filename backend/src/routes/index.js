/**
 * Point d’entrée des routes API : monte toutes les routes sur l’app Express.
 * @param {import('express').Application} app
 * @param {{ dbManager: { isConnected: () => boolean }, connectionCounters?: { getTotalCount: () => number } }} deps
 */
function mountRoutes(app, deps = {}) {
  const { dbManager, connectionCounters } = deps;

  // Bibliothèque média (deux préfixes pour compatibilité)
  const mediaLibraryRouter = require('./media-library');
  app.use('/api/media-library', mediaLibraryRouter);
  app.use('/api/upload/media', mediaLibraryRouter);

  // Routes métier
  app.use('/api/auth', require('./auth'));
  app.use('/api/users', require('./users'));
  app.use('/api/restaurants', require('./restaurants'));
  app.use('/api/movies', require('./movies'));
  app.use('/api/radio', require('./radio'));
  app.use('/api/magazine', require('./magazine'));
  app.use('/api/messages', require('./messages'));
  app.use('/api/sync', require('./sync'));
  app.use('/api/shop', require('./shop'));
  app.use('/api/feedback', require('./feedback'));
  app.use('/api/admin', require('./admin'));
  app.use('/api/analytics', require('./analytics'));
  app.use('/api/gnv', require('./gnv'));
  app.use('/api/upload', require('./upload'));
  app.use('/api/stream', require('./stream'));
  app.use('/api/webtv', require('./webtv'));
  app.use('/api/enfant', require('./enfant'));
  app.use('/api/shipmap', require('./shipmap'));
  app.use('/api/banners', require('./banners'));
  app.use('/api/ads', require('./ads'));
  app.use('/api/trailers', require('./trailers'));
  app.use('/api/notifications', require('./notifications'));
  app.use('/api/export', require('./export'));

  // Health check enrichi (connexions Socket, mémoire) — monitoring / alerte (audit CTO)
  const configModule = require('../config');
  /**
   * @swagger
   * /api/health:
   *   get:
   *     summary: Vérification de l'état du serveur
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Serveur opérationnel
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Health'
   */
  app.get('/api/health', async (req, res) => {
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
      mongodb: dbManager && typeof dbManager.isConnected === 'function' ? (dbConnected ? 'connected' : 'disconnected') : 'unknown',
      offlineMode: !dbConnected,
      connections,
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    };
    if (dbConnected && dbManager.getStats) {
      const stats = dbManager.getStats();
      if (stats.name) {payload.mongodbDatabase = stats.name;}
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
   * /api/time:
   *   get:
   *     summary: Heure serveur pour synchronisation
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Heure serveur
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 serverTime:
   *                   type: string
   *                   format: date-time
   *                 unix:
   *                   type: number
   */
  app.get('/api/time', (req, res) => {
    const now = new Date();
    res.json({ serverTime: now.toISOString(), unix: now.getTime() });
  });
}

module.exports = { mountRoutes };
