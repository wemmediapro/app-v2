/**
 * Données de test réutilisables (users, restaurants, messages, feedback).
 */
const mongoose = require('mongoose');

const oid = (hex = '507f1f77bcf86cd799439011') => new mongoose.Types.ObjectId(hex);

module.exports = {
  oid,

  userValid: {
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'jean.dupont@test.com',
    password: 'Password1!',
    phone: '+33 6 12 34 56 78',
    cabinNumber: 'A12',
    country: 'France',
    role: 'passenger',
  },

  userAdminPayload: {
    firstName: 'Admin',
    lastName: 'Test',
    email: 'newadmin@test.com',
    password: 'Password1!',
    role: 'passenger',
  },

  restaurantValid: {
    name: 'Le Bistrot',
    type: 'Brasserie',
    description: 'Cuisine du marché',
    category: 'french',
    rating: 4.5,
    priceRange: '€€',
    menu: [
      {
        id: 1,
        name: 'Plat',
        description: '',
        price: 12,
        category: 'main',
      },
    ],
  },

  messageValid: {
    sender: oid('507f1f77bcf86cd799439011'),
    receiver: oid('507f1f77bcf86cd799439012'),
    content: 'Bonjour',
    type: 'text',
  },

  feedbackValid: {
    user: oid(),
    type: 'suggestion',
    category: 'service',
    title: 'Idée',
    description: 'Description détaillée du retour utilisateur.',
    priority: 'medium',
  },
};
