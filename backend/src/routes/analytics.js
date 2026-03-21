const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const Movie = require('../models/Movie');
const Article = require('../models/Article');
const RadioStation = require('../models/RadioStation');
const EnfantActivity = require('../models/EnfantActivity');
const Product = require('../models/Product');
const Restaurant = require('../models/Restaurant');
const WebTVChannel = require('../models/WebTVChannel');
const Feedback = require('../models/Feedback');
const connectionCounters = require('../lib/connectionCounters');
const queryCache = require('../lib/queryCache');
const { logRouteError } = require('../lib/route-logger');
const {
  aggregateContentInventorySummary,
  aggregateAnalyticsUserOverview,
  aggregateAnalyticsTemporalContent,
  aggregateAnalyticsRecentFeedback,
} = require('../services/analyticsAggregations');

/** Uptime en pourcentage (basé sur process.uptime(), plafonné à 100 %) */
function getSystemUptimePercent() {
  try {
    const seconds = process.uptime();
    const hours = seconds / 3600;
    // Au-delà de 24h on considère 100 %, sinon proportionnel (ex: 12h = 50 %)
    if (hours >= 24) {
      return 100;
    }
    return Math.min(100, Math.round((hours / 24) * 1000) / 10);
  } catch {
    return 0;
  }
}

/** Croissance en % entre période actuelle et période précédente */
function growthPercent(current, previous) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  const pct = ((current - previous) / previous) * 100;
  return Math.round(pct * 10) / 10;
}

// @route   GET /api/analytics/connections
// @desc    Statistiques de connexions (réelles : Socket.io local)
router.get('/connections', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const activeConnections = connectionCounters.getTotalCountAsync
      ? await connectionCounters.getTotalCountAsync()
      : connectionCounters.getTotalCount
        ? connectionCounters.getTotalCount()
        : 0;
    res.json({
      totalConnections: activeConnections,
      activeConnections,
      peakConnections: activeConnections,
      averageSessionDuration: null,
      connectionTypes: [],
      hourlyConnections: [],
      deviceTypes: [],
      bandwidthUsage: { total: null, average: null, peak: null, byContent: [] },
    });
  } catch (err) {
    logRouteError(req, 'analytics_connections_failed', err);
    res.status(500).json({ message: 'Erreur lors du chargement des connexions' });
  }
});

// @route   GET /api/analytics/content
// @desc    Statistiques de contenu (réelles depuis la BDD)
router.get('/content', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        totalContent: 0,
        contentTypes: [],
        popularContent: [],
        contentEngagement: {},
        userBehavior: {},
      });
    }

    const payload = await queryCache.getCached('statistics:content:v1', async () => {
      let totalMovies = 0;
      let totalArticles = 0;
      let totalRadio = 0;
      let totalActivities = 0;
      let totalProducts = 0;
      let totalRestaurants = 0;
      let totalViewers = 0;
      try {
        const inv = await aggregateContentInventorySummary({
          Movie,
          Article,
          RadioStation,
          EnfantActivity,
          Product,
          Restaurant,
          WebTVChannel,
        });
        totalMovies = inv.totalMovies;
        totalArticles = inv.totalArticles;
        totalRadio = inv.totalRadio;
        totalActivities = inv.totalActivities;
        totalProducts = inv.totalProducts;
        totalRestaurants = inv.totalRestaurants;
        totalViewers = inv.totalViewers;
      } catch {
        const [tm, ta, tr, te, tp, trr, viewersResult] = await Promise.all([
          Movie.countDocuments().catch(() => 0),
          Article.countDocuments().catch(() => 0),
          RadioStation.countDocuments().catch(() => 0),
          EnfantActivity.countDocuments().catch(() => 0),
          Product.countDocuments().catch(() => 0),
          Restaurant.countDocuments({ isActive: true }).catch(() => 0),
          WebTVChannel.aggregate([{ $group: { _id: null, total: { $sum: '$viewers' } } }]).catch(() => []),
        ]);
        totalMovies = tm;
        totalArticles = ta;
        totalRadio = tr;
        totalActivities = te;
        totalProducts = tp;
        totalRestaurants = trr;
        totalViewers = (viewersResult && viewersResult[0] && viewersResult[0].total) || 0;
      }
      const totalContent =
        totalMovies + totalArticles + totalRadio + totalActivities + totalProducts + totalRestaurants;
      const contentTypes = [
        { type: 'Films & séries', count: totalMovies, views: 0, rating: null },
        { type: 'Articles magazine', count: totalArticles, views: 0, rating: null },
        { type: 'Stations radio', count: totalRadio, views: 0, rating: null },
        { type: 'Activités enfant', count: totalActivities, views: 0, rating: null },
        { type: 'Produits shop', count: totalProducts, views: 0, rating: null },
        { type: 'Restaurants', count: totalRestaurants, views: 0, rating: null },
      ].filter((c) => c.count > 0);

      return {
        totalContent,
        contentTypes,
        popularContent: [],
        contentEngagement: { averageWatchTime: null, completionRate: null, favoriteGenres: [], peakViewingHours: [] },
        userBehavior: {
          averageSessionTime: null,
          bounceRate: null,
          returnVisitors: null,
          newVisitors: null,
          mostActiveUsers: [],
        },
        totalViewers,
      };
    });

    res.json(payload);
  } catch (err) {
    logRouteError(req, 'analytics_content_failed', err);
    res.status(500).json({ message: 'Erreur lors du chargement du contenu' });
  }
});

// @route   GET /api/analytics/performance
// @desc    Statistiques de performance (uptime réel, pas de mock)
router.get('/performance', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const uptime = getSystemUptimePercent();
    res.json({
      serverResponseTime: null,
      pageLoadTime: null,
      errorRate: null,
      uptime,
      cacheHitRate: null,
      databaseQueries: { total: null, average: null, slowQueries: null, optimization: null },
    });
  } catch (err) {
    logRouteError(req, 'analytics_performance_failed', err);
    res.status(500).json({ message: 'Erreur lors du chargement des performances' });
  }
});

// @route   GET /api/analytics/overview
// @desc    Vue d'ensemble : utilisateurs, contenu, tendances et alertes réelles
router.get('/overview', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        summary: { totalUsers: 0, activeUsers: 0, totalContent: 0, systemUptime: 0 },
        trends: { userGrowth: 0, contentGrowth: 0, engagementGrowth: 0, performanceImprovement: 0 },
        alerts: [],
      });
    }

    const overviewPayload = await queryCache.getCached('statistics:overview:v1', async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const userStats = await aggregateAnalyticsUserOverview(User, thirtyDaysAgo, sixtyDaysAgo);
      const totalUsers = userStats.totalUsers;
      const activeUsers = userStats.activeUsers;
      const usersLast30Days = userStats.usersLast30;
      const usersPrevious30Days = userStats.usersPrevious30;

      const [movieStats, articleStats, recentFeedbacks, totalRadio, totalActivities, totalProducts, totalRestaurants] =
        await Promise.all([
          aggregateAnalyticsTemporalContent(Movie, thirtyDaysAgo, sixtyDaysAgo),
          typeof Article.countDocuments === 'function'
            ? aggregateAnalyticsTemporalContent(Article, thirtyDaysAgo, sixtyDaysAgo)
            : Promise.resolve({ total: 0, last30: 0, prev30: 0, recent: [] }),
          aggregateAnalyticsRecentFeedback(Feedback, 5),
          RadioStation.countDocuments().catch(() => 0),
          EnfantActivity.countDocuments().catch(() => 0),
          Product.countDocuments().catch(() => 0),
          Restaurant.countDocuments({ isActive: true }).catch(() => 0),
        ]);

      const totalMovies = movieStats.total;
      const totalArticles = articleStats.total;
      const moviesLast30Days = movieStats.last30;
      const moviesPrevious30Days = movieStats.prev30;
      const articlesLast30Days = articleStats.last30;
      const articlesPrevious30Days = articleStats.prev30;
      const recentMovies = movieStats.recent;
      const recentArticles = articleStats.recent;

      const totalContent =
        totalMovies + totalArticles + totalRadio + totalActivities + totalProducts + totalRestaurants;
      const contentLast30 = moviesLast30Days + articlesLast30Days;
      const contentPrevious30 = moviesPrevious30Days + articlesPrevious30Days;

      const userGrowth = growthPercent(usersLast30Days, usersPrevious30Days);
      const contentGrowth = growthPercent(contentLast30, contentPrevious30);
      const systemUptime = getSystemUptimePercent();

      const alerts = [];
      recentFeedbacks.forEach((f) => {
        const status = f.status || 'nouveau';
        const type = status === 'resolved' ? 'success' : status === 'pending' ? 'warning' : 'info';
        alerts.push({
          type,
          message: `${(f.message || '').slice(0, 60)}${f.message && f.message.length > 60 ? '…' : ''}`,
          timestamp: f.createdAt,
        });
      });
      if (recentMovies.length > 0) {
        const titles = recentMovies
          .map((m) => (m.translations && m.translations.fr && m.translations.fr.title) || m.title || 'Film')
          .slice(0, 2);
        alerts.push({
          type: 'info',
          message: `Nouveau(x) film(s) ajouté(s): ${titles.join(', ')}`,
          timestamp: recentMovies[0].createdAt,
        });
      }
      if (recentArticles.length > 0) {
        const titles = recentArticles
          .map((a) => (a.translations && a.translations.fr && a.translations.fr.title) || 'Article')
          .slice(0, 2);
        alerts.push({
          type: 'info',
          message: `Nouveau(x) article(s) magazine: ${titles.join(', ')}`,
          timestamp: recentArticles[0].createdAt,
        });
      }
      alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const alertsFormatted = alerts.slice(0, 10).map((a) => ({
        type: a.type,
        message: a.message,
        timestamp: a.timestamp instanceof Date ? a.timestamp.toISOString() : a.timestamp,
      }));

      return {
        summary: {
          totalUsers,
          activeUsers,
          totalContent,
          systemUptime,
        },
        trends: {
          userGrowth,
          contentGrowth,
          engagementGrowth: 0,
          performanceImprovement: systemUptime >= 99 ? 0 : Math.round((systemUptime / 100) * 10 * 10) / 10,
        },
        alerts: alertsFormatted,
      };
    });

    res.json(overviewPayload);
  } catch (err) {
    logRouteError(req, 'analytics_overview_failed', err);
    res.status(500).json({ message: "Erreur lors du chargement de la vue d'ensemble" });
  }
});

module.exports = router;
