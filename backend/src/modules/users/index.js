// Module de gestion des utilisateurs
const express = require('express');
const { authMiddleware: authenticateToken, adminMiddleware: requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// Données de démonstration des utilisateurs
const demoUsers = [
  {
    _id: 'user1',
    firstName: 'Sophie',
    lastName: 'Leroy',
    email: 'sophie.leroy@email.com',
    role: 'user',
    isActive: true,
    cabinNumber: 'A101',
    phone: '+33 6 12 34 56 78',
    nationality: 'Française',
    age: 28,
    preferences: ['Végétarien', 'WiFi', 'Fitness'],
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: 'user2',
    firstName: 'Pierre',
    lastName: 'Moreau',
    email: 'pierre.moreau@email.com',
    role: 'user',
    isActive: true,
    cabinNumber: 'B205',
    phone: '+33 6 23 45 67 89',
    nationality: 'Française',
    age: 35,
    preferences: ['Carnivore', 'Cinéma', 'Gaming'],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    lastLogin: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: 'user3',
    firstName: 'Marie',
    lastName: 'Dubois',
    email: 'marie.dubois@email.com',
    role: 'user',
    isActive: true,
    cabinNumber: 'C312',
    phone: '+33 6 34 56 78 90',
    nationality: 'Française',
    age: 42,
    preferences: ['Végétarien', 'Spa', 'Lecture'],
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    lastLogin: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    _id: 'user4',
    firstName: 'Jean',
    lastName: 'Martin',
    email: 'jean.martin@email.com',
    role: 'user',
    isActive: true,
    cabinNumber: 'D418',
    phone: '+33 6 45 67 89 01',
    nationality: 'Française',
    age: 31,
    preferences: ['Omnivore', 'Travail', 'WiFi'],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    lastLogin: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    _id: 'user5',
    firstName: 'Emma',
    lastName: 'Bernard',
    email: 'emma.bernard@email.com',
    role: 'user',
    isActive: true,
    cabinNumber: 'E525',
    phone: '+33 6 56 78 90 12',
    nationality: 'Française',
    age: 26,
    preferences: ['Végan', 'Yoga', 'Musique'],
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastLogin: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    _id: 'user6',
    firstName: 'Lucas',
    lastName: 'Petit',
    email: 'lucas.petit@email.com',
    role: 'user',
    isActive: false,
    cabinNumber: 'F601',
    phone: '+33 6 67 89 01 23',
    nationality: 'Française',
    age: 29,
    preferences: ['Carnivore', 'Gaming', 'Bar'],
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: 'user7',
    firstName: 'Anna',
    lastName: 'Schmidt',
    email: 'anna.schmidt@email.com',
    role: 'user',
    isActive: true,
    cabinNumber: 'G703',
    phone: '+49 30 12345678',
    nationality: 'Allemande',
    age: 33,
    preferences: ['Végétarien', 'Fitness', 'Cinéma'],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    lastLogin: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    _id: 'user8',
    firstName: 'Marco',
    lastName: 'Rossi',
    email: 'marco.rossi@email.com',
    role: 'user',
    isActive: true,
    cabinNumber: 'H814',
    phone: '+39 06 12345678',
    nationality: 'Italienne',
    age: 38,
    preferences: ['Omnivore', 'Restaurant', 'Musique'],
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    lastLogin: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
  {
    _id: 'user9',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@email.com',
    role: 'user',
    isActive: true,
    cabinNumber: 'I925',
    phone: '+44 20 12345678',
    nationality: 'Britannique',
    age: 24,
    preferences: ['Végan', 'Spa', 'Lecture'],
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    lastLogin: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    _id: 'user10',
    firstName: 'Ahmed',
    lastName: 'Hassan',
    email: 'ahmed.hassan@email.com',
    role: 'crew',
    isActive: true,
    cabinNumber: 'Crew-001',
    phone: '+33 6 78 90 12 34',
    nationality: 'Marocaine',
    age: 41,
    preferences: ['Halal', 'Travail', 'Famille'],
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: 'user11',
    firstName: 'Isabella',
    lastName: 'Garcia',
    email: 'isabella.garcia@email.com',
    role: 'crew',
    isActive: true,
    cabinNumber: 'Crew-002',
    phone: '+34 91 12345678',
    nationality: 'Espagnole',
    age: 27,
    preferences: ['Omnivore', 'Fitness', 'Danse'],
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    lastLogin: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: 'user12',
    firstName: 'Thomas',
    lastName: 'Anderson',
    email: 'thomas.anderson@email.com',
    role: 'admin',
    isActive: true,
    cabinNumber: 'Admin-001',
    phone: '+33 6 89 01 23 45',
    nationality: 'Française',
    age: 45,
    preferences: ['Omnivore', 'Travail', 'Gestion'],
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    lastLogin: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
];

// GET /api/users - Liste des utilisateurs
router.get('/', authenticateToken, (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    let filteredUsers = [...demoUsers];

    // Filtrage par recherche
    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = filteredUsers.filter(
        (user) =>
          user.firstName.toLowerCase().includes(searchLower) ||
          user.lastName.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower) ||
          user.cabinNumber.toLowerCase().includes(searchLower)
      );
    }

    // Filtrage par rôle
    if (role && role !== 'all') {
      filteredUsers = filteredUsers.filter((user) => user.role === role);
    }

    // Filtrage par statut
    if (status && status !== 'all') {
      const isActive = status === 'active';
      filteredUsers = filteredUsers.filter((user) => user.isActive === isActive);
    }

    // Tri
    filteredUsers.sort((a, b) => {
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
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    res.json({
      users: paginatedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredUsers.length,
        pages: Math.ceil(filteredUsers.length / parseInt(limit)),
      },
      filters: {
        search,
        role,
        status,
        sortBy,
        sortOrder,
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
});

// GET /api/users/:id - Détails d'un utilisateur
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const user = demoUsers.find((u) => u._id === id);

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Si l'utilisateur demande ses propres données ou est admin/crew
    if (req.user.id === id || ['admin', 'crew'].includes(req.user.role)) {
      res.json(user);
    } else {
      // Retourner seulement les données publiques
      const { password, ...publicUser } = user;
      res.json(publicUser);
    }
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: "Erreur lors de la récupération de l'utilisateur" });
  }
});

// PUT /api/users/:id - Mise à jour d'un utilisateur
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Vérifier les permissions
    if (req.user.id !== id && !['admin', 'crew'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Permission refusée' });
    }

    const userIndex = demoUsers.findIndex((u) => u._id === id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Mise à jour des données
    const updatedUser = {
      ...demoUsers[userIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    demoUsers[userIndex] = updatedUser;

    res.json({
      message: 'Utilisateur mis à jour avec succès',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de l'utilisateur" });
  }
});

// DELETE /api/users/:id - Désactivation d'un utilisateur
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const userIndex = demoUsers.findIndex((u) => u._id === id);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Désactivation au lieu de suppression
    demoUsers[userIndex].isActive = false;
    demoUsers[userIndex].deactivatedAt = new Date().toISOString();

    res.json({ message: 'Utilisateur désactivé avec succès' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: "Erreur lors de la désactivation de l'utilisateur" });
  }
});

// POST /api/users/:id/activate - Réactivation d'un utilisateur
router.post('/:id/activate', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const userIndex = demoUsers.findIndex((u) => u._id === id);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    demoUsers[userIndex].isActive = true;
    demoUsers[userIndex].reactivatedAt = new Date().toISOString();

    res.json({ message: 'Utilisateur réactivé avec succès' });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({ error: "Erreur lors de la réactivation de l'utilisateur" });
  }
});

// GET /api/users/:id/activity - Activité d'un utilisateur
router.get('/:id/activity', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier les permissions
    if (req.user.id !== id && !['admin', 'crew'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Permission refusée' });
    }

    // Simulation des données d'activité
    const activity = {
      lastLogin: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      loginCount: Math.floor(Math.random() * 50) + 10,
      totalSessionTime: Math.floor(Math.random() * 1000) + 500, // minutes
      favoriteRestaurants: ['Le Bistrot', 'Sushi Bar'],
      favoriteEntertainment: ["Films d'action", 'Musique classique'],
      totalOrders: Math.floor(Math.random() * 20) + 5,
      totalSpent: Math.floor(Math.random() * 500) + 100,
      feedbackGiven: Math.floor(Math.random() * 10) + 2,
      messagesSent: Math.floor(Math.random() * 50) + 10,
    };

    res.json(activity);
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({ error: "Erreur lors de la récupération de l'activité" });
  }
});

// GET /api/users/stats - Statistiques des utilisateurs
router.get('/stats/overview', authenticateToken, requireAdmin, (req, res) => {
  try {
    const stats = {
      total: demoUsers.length,
      active: demoUsers.filter((u) => u.isActive).length,
      inactive: demoUsers.filter((u) => !u.isActive).length,
      byRole: {
        user: demoUsers.filter((u) => u.role === 'user').length,
        crew: demoUsers.filter((u) => u.role === 'crew').length,
        admin: demoUsers.filter((u) => u.role === 'admin').length,
      },
      byNationality: {
        Française: demoUsers.filter((u) => u.nationality === 'Française').length,
        Allemande: demoUsers.filter((u) => u.nationality === 'Allemande').length,
        Italienne: demoUsers.filter((u) => u.nationality === 'Italienne').length,
        Britannique: demoUsers.filter((u) => u.nationality === 'Britannique').length,
        Marocaine: demoUsers.filter((u) => u.nationality === 'Marocaine').length,
        Espagnole: demoUsers.filter((u) => u.nationality === 'Espagnole').length,
      },
      averageAge: Math.round(demoUsers.reduce((sum, u) => sum + u.age, 0) / demoUsers.length),
      newThisWeek: demoUsers.filter((u) => new Date(u.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .length,
    };

    res.json(stats);
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

// Fonction d'initialisation du module
const initialize = (app, io) => {
  app.use('/api/users', router);
  console.log('✅ Module Users initialisé');
};

module.exports = {
  router,
  initialize,
  demoUsers,
};
