const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Demo analytics data
const analyticsData = {
  connections: {
    totalConnections: 1247,
    activeConnections: 89,
    peakConnections: 156,
    averageSessionDuration: 45,
    connectionTypes: [
      { type: 'WiFi', count: 892, percentage: 71.5 },
      { type: 'Mobile Data', count: 234, percentage: 18.8 },
      { type: 'Ethernet', count: 121, percentage: 9.7 }
    ],
    hourlyConnections: [
      { hour: '00:00', connections: 12 }, { hour: '01:00', connections: 8 }, { hour: '02:00', connections: 5 },
      { hour: '03:00', connections: 3 }, { hour: '04:00', connections: 4 }, { hour: '05:00', connections: 7 },
      { hour: '06:00', connections: 15 }, { hour: '07:00', connections: 28 }, { hour: '08:00', connections: 45 },
      { hour: '09:00', connections: 67 }, { hour: '10:00', connections: 89 }, { hour: '11:00', connections: 95 },
      { hour: '12:00', connections: 102 }, { hour: '13:00', connections: 98 }, { hour: '14:00', connections: 87 },
      { hour: '15:00', connections: 92 }, { hour: '16:00', connections: 88 }, { hour: '17:00', connections: 76 },
      { hour: '18:00', connections: 64 }, { hour: '19:00', connections: 52 }, { hour: '20:00', connections: 38 },
      { hour: '21:00', connections: 25 }, { hour: '22:00', connections: 18 }, { hour: '23:00', connections: 14 }
    ],
    deviceTypes: [
      { type: 'Smartphone', count: 567, percentage: 45.5 },
      { type: 'Laptop', count: 389, percentage: 31.2 },
      { type: 'Tablet', count: 201, percentage: 16.1 },
      { type: 'Desktop', count: 90, percentage: 7.2 }
    ],
    bandwidthUsage: {
      total: 2.4, average: 1.8, peak: 3.2,
      byContent: [
        { type: 'Videos', usage: 1.2, percentage: 50 },
        { type: 'Web Browsing', usage: 0.6, percentage: 25 },
        { type: 'Streaming', usage: 0.4, percentage: 16.7 },
        { type: 'Downloads', usage: 0.2, percentage: 8.3 }
      ]
    }
  },
  content: {
    totalContent: 1247,
    contentTypes: [
      { type: 'Movies', count: 45, views: 2340, rating: 4.2 },
      { type: 'TV Shows', count: 78, views: 1890, rating: 4.1 },
      { type: 'Music', count: 156, views: 3450, rating: 4.3 },
      { type: 'Podcasts', count: 23, views: 890, rating: 4.0 },
      { type: 'Games', count: 34, views: 1200, rating: 4.4 },
      { type: 'Books', count: 67, views: 980, rating: 3.9 }
    ],
    popularContent: [
      { id: 1, title: 'Avengers: Endgame', type: 'Movie', views: 156, rating: 4.8, duration: '3h 1min', category: 'Action' },
      { id: 2, title: 'Stranger Things S4', type: 'TV Show', views: 134, rating: 4.6, duration: '8 episodes', category: 'Drama' },
      { id: 3, title: 'Top Hits 2024', type: 'Music', views: 289, rating: 4.4, duration: '1h 23min', category: 'Pop' },
      { id: 4, title: 'The Witcher 3', type: 'Game', views: 98, rating: 4.9, duration: '50+ hours', category: 'RPG' },
      { id: 5, title: 'Dune', type: 'Movie', views: 112, rating: 4.3, duration: '2h 35min', category: 'Sci-Fi' }
    ],
    contentEngagement: {
      averageWatchTime: 67, completionRate: 78.5,
      favoriteGenres: [
        { genre: 'Action', percentage: 28.5 }, { genre: 'Comedy', percentage: 22.3 },
        { genre: 'Drama', percentage: 18.7 }, { genre: 'Sci-Fi', percentage: 15.2 },
        { genre: 'Horror', percentage: 8.9 }, { genre: 'Romance', percentage: 6.4 }
      ],
      peakViewingHours: [
        { hour: '20:00', viewers: 89 }, { hour: '21:00', viewers: 95 }, { hour: '22:00', viewers: 87 },
        { hour: '19:00', viewers: 76 }, { hour: '23:00', viewers: 64 }
      ]
    },
    userBehavior: {
      averageSessionTime: 45, bounceRate: 12.3, returnVisitors: 68.7, newVisitors: 31.3,
      mostActiveUsers: [
        { name: 'Sophie Leroy', sessions: 23, timeSpent: 18.5 },
        { name: 'Pierre Moreau', sessions: 19, timeSpent: 15.2 },
        { name: 'Marie Dubois', sessions: 17, timeSpent: 12.8 },
        { name: 'Jean Martin', sessions: 15, timeSpent: 11.4 },
        { name: 'Emma Bernard', sessions: 14, timeSpent: 10.9 }
      ]
    }
  },
  performance: {
    serverResponseTime: 245, pageLoadTime: 1.8, errorRate: 0.8, uptime: 99.7, cacheHitRate: 87.3,
    databaseQueries: { total: 12450, average: 12.3, slowQueries: 23, optimization: 'Good' }
  }
};

// Données démo — protéger par auth admin pour cohérence (si données réelles plus tard)
router.get('/connections', authMiddleware, adminMiddleware, (req, res) => {
  res.json(analyticsData.connections);
});

// @route   GET /api/analytics/content
// @desc    Get content statistics
router.get('/content', authMiddleware, adminMiddleware, (req, res) => {
  res.json(analyticsData.content);
});

// @route   GET /api/analytics/performance
// @desc    Get performance statistics
router.get('/performance', authMiddleware, adminMiddleware, (req, res) => {
  res.json(analyticsData.performance);
});

// @route   GET /api/analytics/overview
// @desc    Get overview statistics
router.get('/overview', authMiddleware, adminMiddleware, (req, res) => {
  res.json({
    summary: {
      totalUsers: 1247,
      activeUsers: 89,
      totalContent: 403,
      totalViews: 10850,
      averageRating: 4.2,
      systemUptime: 99.7
    },
    trends: {
      userGrowth: 12.5, // percentage
      contentGrowth: 8.3, // percentage
      engagementGrowth: 15.7, // percentage
      performanceImprovement: 5.2 // percentage
    },
    alerts: [
      {
        type: 'warning',
        message: 'High bandwidth usage detected',
        timestamp: new Date().toISOString()
      },
      {
        type: 'info',
        message: 'New content added: 5 movies, 3 TV shows',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        type: 'success',
        message: 'System performance optimized',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      }
    ]
  });
});

module.exports = router;

