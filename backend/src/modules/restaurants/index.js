// Module de gestion des restaurants et gastronomie
const express = require('express');
const { authMiddleware: authenticateToken, adminMiddleware: requireAdmin } = require('../../middleware/auth');
const { logRouteError } = require('../../lib/route-logger');
const logger = require('../../lib/logger');

const router = express.Router();

// Données de démonstration des restaurants
const demoRestaurants = [
  {
    _id: 'rest1',
    name: 'Le Bistrot',
    type: 'Français',
    description: 'Cuisine française traditionnelle avec une touche moderne',
    location: 'Pont 5',
    priceRange: '€€',
    rating: 4.5,
    isOpen: true,
    specialties: ['Bouillabaisse', 'Coq au vin', 'Tarte tatin'],
    openingHours: '12h-14h, 19h-22h',
    menu: [
      {
        id: 1,
        name: 'Bouillabaisse',
        description: 'Soupe de poissons méditerranéenne',
        price: 28,
        image: '/images/bouillabaisse.jpg',
        category: 'Plat principal',
        allergens: ['Poisson', 'Crustacés'],
        isVegetarian: false,
        isVegan: false,
        isGlutenFree: false,
      },
      {
        id: 2,
        name: 'Coq au vin',
        description: 'Poulet mijoté au vin rouge',
        price: 24,
        image: '/images/coq-au-vin.jpg',
        category: 'Plat principal',
        allergens: ['Gluten'],
        isVegetarian: false,
        isVegan: false,
        isGlutenFree: false,
      },
      {
        id: 3,
        name: 'Tarte tatin',
        description: 'Tarte aux pommes renversée',
        price: 8,
        image: '/images/tarte-tatin.jpg',
        category: 'Dessert',
        allergens: ['Gluten', 'Œufs', 'Lait'],
        isVegetarian: true,
        isVegan: false,
        isGlutenFree: false,
      },
    ],
    promotions: [
      {
        id: 1,
        title: 'Menu déjeuner',
        description: 'Entrée + Plat + Dessert',
        discount: 20,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    images: ['/images/bistrot1.jpg', '/images/bistrot2.jpg'],
    capacity: 80,
    currentOccupancy: 45,
    averageWaitTime: 15,
    features: ['WiFi', 'Terrasse', 'Vue mer'],
    contact: {
      phone: '+33 4 91 23 45 67',
      email: 'bistrot@gnv.com',
    },
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: 'rest2',
    name: 'Sushi Bar',
    type: 'Japonais',
    description: 'Sushi et sashimi frais préparés par nos maîtres sushis',
    location: 'Pont 7',
    priceRange: '€€€',
    rating: 4.7,
    isOpen: true,
    specialties: ['Sashimi', 'Maki', 'Tempura'],
    openingHours: '18h-23h',
    menu: [
      {
        id: 4,
        name: 'Assortiment sashimi',
        description: 'Sélection de 12 pièces de sashimi',
        price: 35,
        image: '/images/sashimi.jpg',
        category: 'Plat principal',
        allergens: ['Poisson'],
        isVegetarian: false,
        isVegan: false,
        isGlutenFree: true,
      },
      {
        id: 5,
        name: 'California roll',
        description: 'Maki au crabe et avocat',
        price: 12,
        image: '/images/california-roll.jpg',
        category: 'Maki',
        allergens: ['Poisson', 'Sésame'],
        isVegetarian: false,
        isVegan: false,
        isGlutenFree: false,
      },
    ],
    promotions: [],
    images: ['/images/sushi-bar1.jpg', '/images/sushi-bar2.jpg'],
    capacity: 40,
    currentOccupancy: 25,
    averageWaitTime: 20,
    features: ['Bar à sushis', 'Vue panoramique'],
    contact: {
      phone: '+33 4 91 23 45 68',
      email: 'sushi@gnv.com',
    },
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: 'rest3',
    name: 'La Terrasse',
    type: 'Méditerranéen',
    description: 'Cuisine méditerranéenne avec vue sur la mer',
    location: 'Pont 6',
    priceRange: '€€',
    rating: 4.3,
    isOpen: true,
    specialties: ['Paella', 'Risotto', 'Tiramisu'],
    openingHours: '12h-15h, 19h-23h',
    menu: [
      {
        id: 6,
        name: 'Paella valenciana',
        description: 'Riz aux fruits de mer et poulet',
        price: 26,
        image: '/images/paella.jpg',
        category: 'Plat principal',
        allergens: ['Crustacés', 'Mollusques'],
        isVegetarian: false,
        isVegan: false,
        isGlutenFree: true,
      },
    ],
    promotions: [
      {
        id: 2,
        title: 'Happy hour',
        description: 'Cocktails à -30%',
        discount: 30,
        validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    images: ['/images/terrasse1.jpg'],
    capacity: 120,
    currentOccupancy: 85,
    averageWaitTime: 10,
    features: ['Terrasse extérieure', 'Vue mer', 'Bar'],
    contact: {
      phone: '+33 4 91 23 45 69',
      email: 'terrasse@gnv.com',
    },
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: 'rest4',
    name: 'Le Grill',
    type: 'Steakhouse',
    description: 'Viandes grillées et spécialités de poisson',
    location: 'Pont 8',
    priceRange: '€€€',
    rating: 4.6,
    isOpen: false,
    specialties: ['Côte de boeuf', 'Magret de canard', 'Filet de saumon'],
    openingHours: '19h-23h',
    menu: [
      {
        id: 7,
        name: 'Côte de boeuf',
        description: '800g pour 2 personnes, accompagnements au choix',
        price: 45,
        image: '/images/cote-boeuf.jpg',
        category: 'Plat principal',
        allergens: [],
        isVegetarian: false,
        isVegan: false,
        isGlutenFree: true,
      },
    ],
    promotions: [],
    images: ['/images/grill1.jpg'],
    capacity: 60,
    currentOccupancy: 0,
    averageWaitTime: 0,
    features: ['Grill visible', 'Cave à vin'],
    contact: {
      phone: '+33 4 91 23 45 70',
      email: 'grill@gnv.com',
    },
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: 'rest5',
    name: 'Café de la Mer',
    type: 'Café',
    description: 'Café, pâtisseries et snacks légers',
    location: 'Pont 3',
    priceRange: '€',
    rating: 4.1,
    isOpen: true,
    specialties: ['Cappuccino', 'Croissants', 'Salades fraîches'],
    openingHours: '6h-22h',
    menu: [
      {
        id: 8,
        name: 'Cappuccino',
        description: 'Café italien avec mousse de lait',
        price: 4,
        image: '/images/cappuccino.jpg',
        category: 'Boisson',
        allergens: ['Lait'],
        isVegetarian: true,
        isVegan: false,
        isGlutenFree: true,
      },
    ],
    promotions: [
      {
        id: 3,
        title: 'Petit-déjeuner complet',
        description: "Café + Croissant + Jus d'orange",
        discount: 20,
        validUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    images: ['/images/cafe1.jpg', '/images/cafe2.jpg'],
    capacity: 50,
    currentOccupancy: 20,
    averageWaitTime: 5,
    features: ['WiFi', 'Vue mer', 'Pâtisseries maison'],
    contact: {
      phone: '+33 4 91 23 45 71',
      email: 'cafe@gnv.com',
    },
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: 'rest6',
    name: 'Le Bar à Vins',
    type: 'Bar',
    description: 'Sélection de vins et tapas',
    location: 'Pont 9',
    priceRange: '€€',
    rating: 4.3,
    isOpen: true,
    specialties: ['Vins français', 'Fromages', 'Charcuterie'],
    openingHours: '17h-01h',
    menu: [
      {
        id: 9,
        name: 'Planche de fromages',
        description: 'Sélection de 5 fromages français',
        price: 18,
        image: '/images/fromages.jpg',
        category: 'Tapas',
        allergens: ['Lait'],
        isVegetarian: true,
        isVegan: false,
        isGlutenFree: true,
      },
    ],
    promotions: [],
    images: ['/images/bar-vins1.jpg'],
    capacity: 30,
    currentOccupancy: 15,
    averageWaitTime: 0,
    features: ['Cave à vin', 'Ambiance cosy'],
    contact: {
      phone: '+33 4 91 23 45 72',
      email: 'bar-vins@gnv.com',
    },
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: 'rest7',
    name: 'Le Snack',
    type: 'Fast Food',
    description: 'Burgers, frites et boissons',
    location: 'Pont 2',
    priceRange: '€',
    rating: 3.8,
    isOpen: true,
    specialties: ['Burgers', 'Frites', 'Milkshakes'],
    openingHours: '11h-23h',
    menu: [
      {
        id: 10,
        name: 'Cheeseburger',
        description: 'Steak haché, fromage, salade, tomate',
        price: 9,
        image: '/images/cheeseburger.jpg',
        category: 'Burger',
        allergens: ['Gluten', 'Lait', 'Œufs'],
        isVegetarian: false,
        isVegan: false,
        isGlutenFree: false,
      },
    ],
    promotions: [
      {
        id: 4,
        title: 'Menu Burger',
        description: 'Burger + Frites + Boisson',
        discount: 25,
        validUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    images: ['/images/snack1.jpg'],
    capacity: 100,
    currentOccupancy: 60,
    averageWaitTime: 8,
    features: ['Service rapide', 'Emporté'],
    contact: {
      phone: '+33 4 91 23 45 73',
      email: 'snack@gnv.com',
    },
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// GET /api/restaurants - Liste des restaurants
router.get('/', (req, res) => {
  try {
    const { type, priceRange, isOpen, search, page = 1, limit = 20, sortBy = 'rating', sortOrder = 'desc' } = req.query;

    let filteredRestaurants = [...demoRestaurants];

    // Filtrage par type
    if (type && type !== 'all') {
      filteredRestaurants = filteredRestaurants.filter((rest) => rest.type === type);
    }

    // Filtrage par gamme de prix
    if (priceRange && priceRange !== 'all') {
      filteredRestaurants = filteredRestaurants.filter((rest) => rest.priceRange === priceRange);
    }

    // Filtrage par statut d'ouverture
    if (isOpen !== undefined) {
      const isOpenBool = isOpen === 'true';
      filteredRestaurants = filteredRestaurants.filter((rest) => rest.isOpen === isOpenBool);
    }

    // Filtrage par recherche
    if (search) {
      const searchLower = search.toLowerCase();
      filteredRestaurants = filteredRestaurants.filter(
        (rest) =>
          rest.name.toLowerCase().includes(searchLower) ||
          rest.description.toLowerCase().includes(searchLower) ||
          rest.specialties.some((spec) => spec.toLowerCase().includes(searchLower))
      );
    }

    // Tri
    filteredRestaurants.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedRestaurants = filteredRestaurants.slice(startIndex, endIndex);

    res.json({
      restaurants: paginatedRestaurants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredRestaurants.length,
        pages: Math.ceil(filteredRestaurants.length / parseInt(limit)),
      },
      filters: {
        type,
        priceRange,
        isOpen,
        search,
        sortBy,
        sortOrder,
      },
    });
  } catch (error) {
    logRouteError(req, 'module_restaurants_list_failed', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des restaurants' });
  }
});

// GET /api/restaurants/:id - Détails d'un restaurant
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = demoRestaurants.find((r) => r._id === id);

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }

    res.json(restaurant);
  } catch (error) {
    logRouteError(req, 'module_restaurants_get_failed', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du restaurant' });
  }
});

// GET /api/restaurants/:id/menu - Menu d'un restaurant
router.get('/:id/menu', (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = demoRestaurants.find((r) => r._id === id);

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }

    const { category, allergens, dietary } = req.query;
    let menu = restaurant.menu;

    // Filtrage par catégorie
    if (category && category !== 'all') {
      menu = menu.filter((item) => item.category === category);
    }

    // Filtrage par allergènes
    if (allergens) {
      const allergenList = allergens.split(',');
      menu = menu.filter((item) => !allergenList.some((allergen) => item.allergens.includes(allergen)));
    }

    // Filtrage par régime alimentaire
    if (dietary) {
      switch (dietary) {
        case 'vegetarian':
          menu = menu.filter((item) => item.isVegetarian);
          break;
        case 'vegan':
          menu = menu.filter((item) => item.isVegan);
          break;
        case 'gluten-free':
          menu = menu.filter((item) => item.isGlutenFree);
          break;
      }
    }

    res.json({
      restaurant: {
        _id: restaurant._id,
        name: restaurant.name,
        type: restaurant.type,
      },
      menu,
    });
  } catch (error) {
    logRouteError(req, 'module_restaurants_menu_failed', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du menu' });
  }
});

// POST /api/restaurants - Créer un restaurant (Admin)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const restaurantData = req.body;

    const newRestaurant = {
      _id: 'rest' + Date.now(),
      ...restaurantData,
      createdAt: new Date().toISOString(),
      isOpen: true,
      currentOccupancy: 0,
      averageWaitTime: 0,
    };

    demoRestaurants.push(newRestaurant);

    res.status(201).json({
      message: 'Restaurant créé avec succès',
      restaurant: newRestaurant,
    });
  } catch (error) {
    logRouteError(req, 'module_restaurants_create_failed', error);
    res.status(500).json({ error: 'Erreur lors de la création du restaurant' });
  }
});

// PUT /api/restaurants/:id - Mettre à jour un restaurant (Admin)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const restaurantIndex = demoRestaurants.findIndex((r) => r._id === id);
    if (restaurantIndex === -1) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }

    const updatedRestaurant = {
      ...demoRestaurants[restaurantIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    demoRestaurants[restaurantIndex] = updatedRestaurant;

    res.json({
      message: 'Restaurant mis à jour avec succès',
      restaurant: updatedRestaurant,
    });
  } catch (error) {
    logRouteError(req, 'module_restaurants_update_failed', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du restaurant' });
  }
});

// DELETE /api/restaurants/:id - Supprimer un restaurant (Admin)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const restaurantIndex = demoRestaurants.findIndex((r) => r._id === id);

    if (restaurantIndex === -1) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }

    demoRestaurants.splice(restaurantIndex, 1);

    res.json({ message: 'Restaurant supprimé avec succès' });
  } catch (error) {
    logRouteError(req, 'module_restaurants_delete_failed', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du restaurant' });
  }
});

// GET /api/restaurants/categories/list - Liste des catégories
router.get('/categories/list', (req, res) => {
  try {
    const categories = [
      { id: 'all', name: 'Tous', icon: '🍽️' },
      { id: 'Français', name: 'Français', icon: '🥖' },
      { id: 'Japonais', name: 'Japonais', icon: '🍣' },
      { id: 'Méditerranéen', name: 'Méditerranéen', icon: '🫒' },
      { id: 'Steakhouse', name: 'Steakhouse', icon: '🥩' },
      { id: 'Café', name: 'Café', icon: '☕' },
      { id: 'Bar', name: 'Bar', icon: '🍷' },
      { id: 'Fast Food', name: 'Fast Food', icon: '🍔' },
    ];

    res.json(categories);
  } catch (error) {
    logRouteError(req, 'module_restaurants_categories_failed', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des catégories' });
  }
});

// GET /api/restaurants/stats/overview - Statistiques des restaurants
router.get('/stats/overview', authenticateToken, requireAdmin, (req, res) => {
  try {
    const stats = {
      total: demoRestaurants.length,
      open: demoRestaurants.filter((r) => r.isOpen).length,
      closed: demoRestaurants.filter((r) => !r.isOpen).length,
      averageRating:
        Math.round((demoRestaurants.reduce((sum, r) => sum + r.rating, 0) / demoRestaurants.length) * 10) / 10,
      totalCapacity: demoRestaurants.reduce((sum, r) => sum + r.capacity, 0),
      currentOccupancy: demoRestaurants.reduce((sum, r) => sum + r.currentOccupancy, 0),
      byType: {
        Français: demoRestaurants.filter((r) => r.type === 'Français').length,
        Japonais: demoRestaurants.filter((r) => r.type === 'Japonais').length,
        Méditerranéen: demoRestaurants.filter((r) => r.type === 'Méditerranéen').length,
        Steakhouse: demoRestaurants.filter((r) => r.type === 'Steakhouse').length,
        Café: demoRestaurants.filter((r) => r.type === 'Café').length,
        Bar: demoRestaurants.filter((r) => r.type === 'Bar').length,
        'Fast Food': demoRestaurants.filter((r) => r.type === 'Fast Food').length,
      },
      byPriceRange: {
        '€': demoRestaurants.filter((r) => r.priceRange === '€').length,
        '€€': demoRestaurants.filter((r) => r.priceRange === '€€').length,
        '€€€': demoRestaurants.filter((r) => r.priceRange === '€€€').length,
      },
    };

    res.json(stats);
  } catch (error) {
    logRouteError(req, 'module_restaurants_stats_failed', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

// Fonction d'initialisation du module
const initialize = (app, _io) => {
  app.use('/api/restaurants', router);
  logger.info({ event: 'module_restaurants_initialized' });
};

module.exports = {
  router,
  initialize,
  demoRestaurants,
};
