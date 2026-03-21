/**
 * Pipelines d'agrégation MongoDB pour le dashboard admin et les analytics.
 * Réduit les allers-retours réseau en regroupant comptages / facettes ($facet, $unionWith).
 */

'use strict';

/**
 * @param {Array<{ c?: number }>|undefined} arr
 * @returns {number}
 */
function facetCount(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return 0;
  }
  const v = arr[0].c;
  return typeof v === 'number' ? v : 0;
}

/**
 * @param {import('mongoose').Model} User
 * @param {Date} thirtyDaysAgo
 * @param {Date} sixtyDaysAgo
 */
async function aggregateAnalyticsUserOverview(User, thirtyDaysAgo, sixtyDaysAgo) {
  const rows = await User.aggregate([
    {
      $facet: {
        totalUsers: [{ $count: 'c' }],
        activeUsers: [{ $match: { isActive: true } }, { $count: 'c' }],
        usersLast30: [{ $match: { createdAt: { $gte: thirtyDaysAgo } } }, { $count: 'c' }],
        usersPrevious30: [{ $match: { createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } } }, { $count: 'c' }],
      },
    },
  ]);
  const row = rows[0] || {};
  return {
    totalUsers: facetCount(row.totalUsers),
    activeUsers: facetCount(row.activeUsers),
    usersLast30: facetCount(row.usersLast30),
    usersPrevious30: facetCount(row.usersPrevious30),
  };
}

/**
 * @param {import('mongoose').Model} Model
 * @param {Date} thirtyDaysAgo
 * @param {Date} sixtyDaysAgo
 */
async function aggregateAnalyticsTemporalContent(Model, thirtyDaysAgo, sixtyDaysAgo) {
  try {
    const rows = await Model.aggregate([
      {
        $facet: {
          total: [{ $count: 'c' }],
          last30: [{ $match: { createdAt: { $gte: thirtyDaysAgo } } }, { $count: 'c' }],
          prev30: [{ $match: { createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } } }, { $count: 'c' }],
          recent: [
            { $sort: { createdAt: -1 } },
            { $limit: 3 },
            { $project: { title: 1, translations: 1, createdAt: 1 } },
          ],
        },
      },
    ]);
    const row = rows[0] || {};
    return {
      total: facetCount(row.total),
      last30: facetCount(row.last30),
      prev30: facetCount(row.prev30),
      recent: Array.isArray(row.recent) ? row.recent : [],
    };
  } catch {
    return { total: 0, last30: 0, prev30: 0, recent: [] };
  }
}

/**
 * @param {import('mongoose').Model} Feedback
 * @param {number} [limit]
 */
async function aggregateAnalyticsRecentFeedback(Feedback, limit = 5) {
  try {
    return await Feedback.aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      {
        $project: {
          status: 1,
          title: 1,
          description: 1,
          message: 1,
          createdAt: 1,
        },
      },
    ]);
  } catch {
    return [];
  }
}

/**
 * @param {import('mongoose').Model} User
 */
async function aggregateAdminUserDashboard(User) {
  const rows = await User.aggregate([
    {
      $facet: {
        totalUsers: [{ $count: 'c' }],
        activeUsers: [{ $match: { isActive: true } }, { $count: 'c' }],
        usersByRole: [{ $group: { _id: '$role', count: { $sum: 1 } } }],
        recentUsers: [
          { $sort: { createdAt: -1 } },
          { $limit: 5 },
          { $project: { firstName: 1, lastName: 1, email: 1, createdAt: 1 } },
        ],
      },
    },
  ]);
  const row = rows[0] || {};
  return {
    totalUsers: facetCount(row.totalUsers),
    activeUsers: facetCount(row.activeUsers),
    usersByRole: Array.isArray(row.usersByRole) ? row.usersByRole : [],
    recentUsers: Array.isArray(row.recentUsers) ? row.recentUsers : [],
  };
}

/**
 * @param {import('mongoose').Model} Feedback
 */
async function aggregateAdminFeedbackDashboard(Feedback) {
  const rows = await Feedback.aggregate([
    {
      $facet: {
        totalFeedback: [{ $count: 'c' }],
        feedbackByStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        recentFeedback: [
          { $sort: { createdAt: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: 'users',
              localField: 'user',
              foreignField: '_id',
              pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }],
              as: 'user',
            },
          },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        ],
      },
    },
  ]);
  const row = rows[0] || {};
  return {
    totalFeedback: facetCount(row.totalFeedback),
    feedbackByStatus: Array.isArray(row.feedbackByStatus) ? row.feedbackByStatus : [],
    recentFeedback: Array.isArray(row.recentFeedback) ? row.recentFeedback : [],
  };
}

/**
 * Comptages multi-collections en une requête (MongoDB 4.4+ $unionWith).
 * @param {object} models
 * @param {import('mongoose').Model} models.Movie
 * @param {import('mongoose').Model} models.Article
 * @param {import('mongoose').Model} models.RadioStation
 * @param {import('mongoose').Model} models.EnfantActivity
 * @param {import('mongoose').Model} models.Product
 * @param {import('mongoose').Model} models.Restaurant
 * @param {import('mongoose').Model} models.WebTVChannel
 */
async function aggregateContentInventorySummary(models) {
  const { Movie, Article, RadioStation, EnfantActivity, Product, Restaurant, WebTVChannel } = models;
  const name = (m) => m.collection.name;

  const pipeline = [
    { $group: { _id: 'movies', count: { $sum: 1 } } },
    { $unionWith: { coll: name(Article), pipeline: [{ $group: { _id: 'articles', count: { $sum: 1 } } }] } },
    { $unionWith: { coll: name(RadioStation), pipeline: [{ $group: { _id: 'radio', count: { $sum: 1 } } }] } },
    { $unionWith: { coll: name(EnfantActivity), pipeline: [{ $group: { _id: 'enfant', count: { $sum: 1 } } }] } },
    { $unionWith: { coll: name(Product), pipeline: [{ $group: { _id: 'products', count: { $sum: 1 } } }] } },
    {
      $unionWith: {
        coll: name(Restaurant),
        pipeline: [{ $match: { isActive: true } }, { $group: { _id: 'restaurants', count: { $sum: 1 } } }],
      },
    },
    {
      $unionWith: {
        coll: name(WebTVChannel),
        pipeline: [
          {
            $group: {
              _id: 'webtv_viewers',
              totalViewers: { $sum: { $ifNull: ['$viewers', 0] } },
            },
          },
        ],
      },
    },
  ];

  const rows = await Movie.aggregate(pipeline);
  const map = Object.fromEntries(rows.map((r) => [r._id, r]));
  return {
    totalMovies: map.movies?.count ?? 0,
    totalArticles: map.articles?.count ?? 0,
    totalRadio: map.radio?.count ?? 0,
    totalActivities: map.enfant?.count ?? 0,
    totalProducts: map.products?.count ?? 0,
    totalRestaurants: map.restaurants?.count ?? 0,
    totalViewers: map.webtv_viewers?.totalViewers ?? 0,
  };
}

module.exports = {
  facetCount,
  aggregateAnalyticsUserOverview,
  aggregateAnalyticsTemporalContent,
  aggregateAnalyticsRecentFeedback,
  aggregateAdminUserDashboard,
  aggregateAdminFeedbackDashboard,
  aggregateContentInventorySummary,
};
