// Modules Backend GNV - Point d'entrée central
// Tous les modules de l'application sont regroupés ici

const authModule = require('./auth');
const userModule = require('./users');
const restaurantModule = require('./restaurants');
const entertainmentModule = require('./entertainment');
const communicationModule = require('./communication');
const ecommerceModule = require('./ecommerce');
const analyticsModule = require('./analytics');
const adminModule = require('./admin');
const notificationModule = require('./notifications');
const bookingModule = require('./booking');
const loyaltyModule = require('./loyalty');
const logger = require('../lib/logger');

module.exports = {
  // Modules principaux
  auth: authModule,
  users: userModule,
  restaurants: restaurantModule,
  entertainment: entertainmentModule,
  communication: communicationModule,
  ecommerce: ecommerceModule,
  analytics: analyticsModule,
  admin: adminModule,
  notifications: notificationModule,
  booking: bookingModule,
  loyalty: loyaltyModule,

  // Fonction utilitaire pour initialiser tous les modules
  initializeModules: (app, io) => {
    logger.info({ event: 'backend_modules_init_start' });

    // Initialisation de chaque module
    authModule.initialize(app, io);
    userModule.initialize(app, io);
    restaurantModule.initialize(app, io);
    entertainmentModule.initialize(app, io);
    communicationModule.initialize(app, io);
    ecommerceModule.initialize(app, io);
    analyticsModule.initialize(app, io);
    adminModule.initialize(app, io);
    notificationModule.initialize(app, io);
    bookingModule.initialize(app, io);
    loyaltyModule.initialize(app, io);

    logger.info({ event: 'backend_modules_init_done' });
  },

  // Statistiques des modules
  getModuleStats: () => {
    return {
      totalModules: 11,
      modules: [
        { name: 'Authentication', status: 'active', endpoints: 8 },
        { name: 'Users', status: 'active', endpoints: 12 },
        { name: 'Restaurants', status: 'active', endpoints: 15 },
        { name: 'Entertainment', status: 'active', endpoints: 20 },
        { name: 'Communication', status: 'active', endpoints: 10 },
        { name: 'E-commerce', status: 'active', endpoints: 18 },
        { name: 'Analytics', status: 'active', endpoints: 12 },
        { name: 'Admin', status: 'active', endpoints: 25 },
        { name: 'Notifications', status: 'active', endpoints: 6 },
        { name: 'Booking', status: 'active', endpoints: 14 },
        { name: 'Loyalty', status: 'active', endpoints: 8 },
      ],
      totalEndpoints: 148,
    };
  },
};
