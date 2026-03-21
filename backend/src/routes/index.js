/**
 * Point d’entrée des routes API : monte les routeurs Express pour chaque base (`/api`, `/api/v1`, …).
 *
 * Versionnement : préfixe canonique **`/api/v1`** ; **`/api`** reste un alias (rétrocompatibilité app / proxies).
 * `mountRoutes` itère `API_BASE_PATHS` (ou `deps.apiBases`) pour dupliquer les mêmes montages sur chaque base.
 *
 * Regroupement logique dans `mountRoutesAtBase` (ordre sensible aux chemins les plus spécifiques) :
 * - **Médias & fichiers** : `media-library`, `upload`, `stream`
 * - **Auth & utilisateurs** : `auth`, `users`
 * - **Contenu passager** : `restaurants`, `movies`, `radio`, `magazine`, `webtv`, `enfant`, `shipmap`, `banners`, `trailers`, `notifications`, `shop`, `gnv`
 * - **Temps réel / sync** : `messages`, `sync`
 * - **Admin & ops** : `admin`, `analytics`, `export`, `feedback`, `ads`
 * - **Santé** : `GET …/health`, `GET …/health/live`, `GET …/health/ready` (`routes/health.js`)
 * @param {import('express').Application} app
 * @param {{ dbManager: { isConnected: () => boolean }, connectionCounters?: object, apiBases?: string[], cacheManager?: { pingHealth?: () => Promise<{ ok: boolean, status: string }> }, externalHealthServices?: Record<string, { healthCheck: () => Promise<void> }> }} deps
 */
function mountRoutes(app, deps = {}) {
  const { dbManager, connectionCounters, apiBases, cacheManager, externalHealthServices } = deps;
  const { API_BASE_PATHS } = require('../constants/apiVersion');
  const bases = Array.isArray(apiBases) && apiBases.length ? apiBases : API_BASE_PATHS;

  for (const base of bases) {
    mountRoutesAtBase(app, base, { dbManager, connectionCounters, cacheManager, externalHealthServices });
  }
}

/**
 * @param {import('express').Application} app
 * @param {string} base ex. /api/v1 ou /api
 */
function mountRoutesAtBase(app, base, { dbManager, connectionCounters, cacheManager, externalHealthServices }) {
  // Même arbre de routeurs pour chaque `base` ; les chemins absolus dans les routeurs restent relatifs à `base`.
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

  const { registerHealthRoutes } = require('./health');
  registerHealthRoutes(app, base, {
    dbManager,
    connectionCounters,
    cacheManager,
    externalServices: externalHealthServices,
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
