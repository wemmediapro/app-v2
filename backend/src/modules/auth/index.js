// Module d'authentification et autorisation
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const config = require('../config');

const router = express.Router();

// Rate limiting pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives par IP
  message: { error: 'Trop de tentatives de connexion, réessayez dans 15 minutes' }
});

// Middleware d'authentification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token d\'accès requis' });
  }

  const secret = config.jwt?.secret;
  if (!secret) {
    return res.status(503).json({ error: 'JWT non configuré (JWT_SECRET manquant)' });
  }
  jwt.verify(token, secret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide' });
    }
    req.user = user;
    next();
  });
};

// Middleware d'autorisation admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès administrateur requis' });
  }
  next();
};

// Middleware d'autorisation équipage
const requireCrew = (req, res, next) => {
  if (!['admin', 'crew'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Accès équipage requis' });
  }
  next();
};

// Routes d'authentification
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation des données
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Simulation d'un utilisateur (en mode démo)
    const demoUsers = [
      {
        id: '1',
        email: 'admin@gnv.com',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
        role: 'admin',
        firstName: 'Admin',
        lastName: 'GNV',
        cabinNumber: 'Admin-001'
      },
      {
        id: '2',
        email: 'crew@gnv.com',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
        role: 'crew',
        firstName: 'Équipage',
        lastName: 'GNV',
        cabinNumber: 'Crew-001'
      },
      {
        id: '3',
        email: 'user@gnv.com',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
        role: 'user',
        firstName: 'Passager',
        lastName: 'GNV',
        cabinNumber: 'A101'
      }
    ];

    const user = demoUsers.find(u => u.email === email);
    
    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Vérification du mot de passe (en mode démo, on accepte "password")
    const validPassword = password === 'password' || await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Génération du token JWT
    const secret = config.jwt?.secret;
    if (!secret) {
      return res.status(503).json({ error: 'JWT non configuré (JWT_SECRET manquant)' });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, cabinNumber: user.cabinNumber },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || config.jwt?.expiresIn || '7d' }
    );

    res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        cabinNumber: user.cabinNumber
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
  }
});

// Inscription
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, cabinNumber } = req.body;

    // Validation des données
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    // Vérification si l'utilisateur existe déjà (même liste que le login en mode démo)
    const demoEmails = ['admin@gnv.com', 'crew@gnv.com', 'user@gnv.com'];
    const emailNorm = String(email).trim().toLowerCase();
    const userExists = demoEmails.some((e) => e.toLowerCase() === emailNorm);

    if (userExists) {
      return res.status(400).json({ error: 'Un compte existe déjà avec cet email' });
    }

    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Création de l'utilisateur (simulation)
    const newUser = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      firstName,
      lastName,
      cabinNumber: cabinNumber || 'A' + Math.floor(Math.random() * 1000),
      role: 'user',
      createdAt: new Date().toISOString()
    };

    // Génération du token
    const secret = config.jwt?.secret;
    if (!secret) {
      return res.status(503).json({ error: 'JWT non configuré (JWT_SECRET manquant)' });
    }
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role, cabinNumber: newUser.cabinNumber },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || config.jwt?.expiresIn || '7d' }
    );

    res.status(201).json({
      message: 'Compte créé avec succès',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        cabinNumber: newUser.cabinNumber
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erreur serveur lors de l\'inscription' });
  }
});

// Vérification du token
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: req.user
  });
});

// Déconnexion
router.post('/logout', (req, res) => {
  // En JWT, la déconnexion se fait côté client
  res.json({ message: 'Déconnexion réussie' });
});

// Changement de mot de passe
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis' });
    }

    // Simulation de la vérification du mot de passe actuel
    const validCurrentPassword = currentPassword === 'password';
    
    if (!validCurrentPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    }

    // Hash du nouveau mot de passe
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    res.json({ message: 'Mot de passe modifié avec succès' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Erreur serveur lors du changement de mot de passe' });
  }
});

// Réinitialisation de mot de passe
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }

    // Simulation de l'envoi d'email de réinitialisation
    res.json({ 
      message: 'Email de réinitialisation envoyé (simulation)',
      resetToken: 'demo-reset-token-' + Date.now()
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la réinitialisation' });
  }
});

// Réinitialisation avec token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
    }

    // Simulation de la vérification du token
    if (!token.startsWith('demo-reset-token-')) {
      return res.status(400).json({ error: 'Token de réinitialisation invalide' });
    }

    res.json({ message: 'Mot de passe réinitialisé avec succès' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la réinitialisation' });
  }
});

// Fonction d'initialisation du module
const initialize = (app, io) => {
  app.use('/api/auth', router);
  console.log('✅ Module Auth initialisé');
};

module.exports = {
  router,
  authenticateToken,
  requireAdmin,
  requireCrew,
  initialize
};

