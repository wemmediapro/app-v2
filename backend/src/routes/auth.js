const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { registerValidation, loginValidation, profileValidation } = require('../middleware/validation');
const {
  generateToken,
  verifyToken,
  getTokenFromRequest,
  authMiddleware,
  adminMiddleware,
  generateTwoFactorChallengeToken,
  verifyTwoFactorChallengeToken,
} = require('../middleware/auth');
const User = require('../models/User');
const cacheManager = require('../lib/cache-manager');
const { logFailedLogin, logApiError } = require('../lib/logger');
const authService = require('../services/authService');
const auditService = require('../services/auditService');
const { auditContext } = require('../middleware/auditLog');

async function invalidateAuthUserCache(userId) {
  if (!userId || !cacheManager.isConnected) {
    return;
  }
  try {
    await cacheManager.del(`auth:user:${userId}`);
  } catch (_) {
    /* ignore */
  }
}

// [SEC-1/PERF-1] Hash bcrypt admin pré-calculé une fois au premier login (évite bcrypt.hash à chaque requête)
let cachedAdminPasswordHash = null;
async function getAdminPasswordHash(adminPassword) {
  if (!adminPassword) {
    return null;
  }
  if (cachedAdminPasswordHash !== null) {
    return cachedAdminPasswordHash;
  }
  cachedAdminPasswordHash = await bcrypt.hash(adminPassword, 12);
  return cachedAdminPasswordHash;
}

// Limite : 5 tentatives de login par 15 min par IP (brute-force protection, configurable via LOGIN_RATE_LIMIT_MAX)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 5,
  message: { message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Trop de tentatives d'inscription. Réessayez dans 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

/** Option secure du cookie : true seulement si la requête arrive en HTTPS (évite 401 sur dashboard en HTTP). */
function isSecureRequest(req) {
  const proto = req.get('X-Forwarded-Proto');
  if (proto === 'https') {
    return true;
  }
  if (proto === 'http') {
    return false;
  }
  return !!req.secure;
}

function getCookieOptions(req) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' ? isSecureRequest(req) : false,
    sameSite: 'lax', // 'lax' pour éviter déconnexion auto (strict bloquait l'envoi du cookie après login)
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Enregistrer un nouvel utilisateur (admin uniquement)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               phone:
 *                 type: string
 *               cabinNumber:
 *                 type: string
 *               country:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Email déjà utilisé
 *       401:
 *         description: Non autorisé (admin requis)
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.post(
  '/register',
  authMiddleware,
  adminMiddleware,
  auditContext,
  registerLimiter,
  registerValidation,
  async (req, res) => {
    try {
      const { firstName, lastName, email, password, phone, cabinNumber, country, dateOfBirth } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists with this email' });
      }

      // C3 : new User() + save() → mot de passe hashé par le hook pre('save') du modèle User (bcrypt).
      const user = new User({
        firstName,
        lastName,
        email,
        password,
        phone,
        cabinNumber,
        country: country || undefined,
        dateOfBirth: dateOfBirth || undefined,
      });

      await user.save();

      await auditService.logAction({
        userId: req.user._id,
        action: 'create-user',
        resource: 'user',
        resourceId: user._id,
        changes: { after: { email: user.email, role: user.role } },
        ipAddress: req.auditContext?.ipAddress,
        userAgent: req.auditContext?.userAgent,
      });

      // [SEC-4] JWT uniquement dans le cookie httpOnly, pas dans le body
      const token = generateToken({
        id: user._id,
        email: user.email,
        role: user.role,
      });
      res.cookie('authToken', token, getCookieOptions(req));

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          cabinNumber: user.cabinNumber,
          country: user.country,
          dateOfBirth: user.dateOfBirth,
          phone: user.phone,
          userData: user.userData || {
            favorites: { magazineIds: [], restaurantIds: [], enfantIds: [], watchlist: [], shopItems: [] },
            playbackPositions: {},
          },
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Server error during registration' });
    }
  }
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connexion utilisateur
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         headers:
 *           Set-Cookie:
 *             description: Cookie d'authentification httpOnly
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Identifiants invalides
 *       429:
 *         description: Trop de tentatives
 */
/** Email de démo interdit en production (credential par défaut documenté historiquement). */
const FORBIDDEN_PROD_ADMIN_EMAIL = 'admin@gnv.com';

router.post('/login', auditContext, loginLimiter, loginValidation, async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;
    const isProduction = process.env.NODE_ENV === 'production';

    // Obligatoire : aucun identifiant codé en dur — configuration serveur incomplète = 500
    const adminPasswordOk = typeof adminPassword === 'string' && adminPassword.length > 0;
    if (!adminEmail || !adminPasswordOk) {
      logApiError('Auth misconfiguration: ADMIN_EMAIL and ADMIN_PASSWORD required', {
        hasAdminEmail: !!adminEmail,
        hasAdminPassword: adminPasswordOk,
      });
      return res.status(500).json({
        message:
          'Erreur de configuration serveur : définissez ADMIN_EMAIL et ADMIN_PASSWORD dans config.env (aucune valeur par défaut).',
      });
    }

    const emailNorm = (email && String(email).trim().toLowerCase()) || '';
    if (isProduction && emailNorm === FORBIDDEN_PROD_ADMIN_EMAIL) {
      logFailedLogin(email, 'forbidden_default_admin_email', req);
      return res.status(403).json({
        message:
          'Cet identifiant administrateur n’est pas autorisé en production. Utilisez un email dédié défini dans ADMIN_EMAIL.',
      });
    }

    const effectiveAdminEmail = adminEmail;
    const effectiveAdminPassword = adminPassword;
    // P3 : jamais de comparaison en clair — hash bcrypt pré-calculé (SEC-1/PERF-1)
    const adminPasswordHash = await getAdminPasswordHash(effectiveAdminPassword);

    // Find user by email (inclure le password pour comparePassword, car select: false sur le schéma)
    let user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
    if (!user) {
      // C3 / P2 : auto-création admin — comparaison uniquement via bcrypt.compare (jamais === en clair).
      // User créé avec mot de passe en clair puis save() → pre('save') bcrypt du modèle hash avant persistance.
      const envPasswordMatches = adminPasswordHash && (await bcrypt.compare(password, adminPasswordHash));
      if (email.trim().toLowerCase() === effectiveAdminEmail && envPasswordMatches) {
        const adminUser = new User({
          firstName: 'Admin',
          lastName: 'GNV',
          email: effectiveAdminEmail,
          password: effectiveAdminPassword,
          role: 'admin',
          isActive: true,
        });
        await adminUser.save();
        user = adminUser;
      } else {
        logFailedLogin(email, 'user_not_found', req);
        await auditService.logAction({
          userId: null,
          action: 'login',
          resource: 'auth',
          status: 'failure',
          errorMessage: 'user_not_found',
          ipAddress: req.auditContext?.ipAddress,
          userAgent: req.auditContext?.userAgent,
          metadata: { attemptedEmail: email },
        });
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
      }
    } else {
      // Check if user is active
      if (!user.isActive) {
        logFailedLogin(email, 'account_deactivated', req);
        await auditService.logAction({
          userId: null,
          action: 'login',
          resource: 'auth',
          status: 'failure',
          errorMessage: 'account_deactivated',
          ipAddress: req.auditContext?.ipAddress,
          userAgent: req.auditContext?.userAgent,
          metadata: { attemptedEmail: email },
        });
        return res.status(401).json({ message: 'Compte désactivé' });
      }

      // C3 / P3 : comparaison toujours via bcrypt.compare / user.comparePassword, jamais timing ou === en clair.
      const isPasswordValid = await user.comparePassword(password);
      const envPasswordMatch =
        user.role === 'admin' && adminPasswordHash && (await bcrypt.compare(password, adminPasswordHash));
      if (!isPasswordValid && !envPasswordMatch) {
        logFailedLogin(email, 'invalid_password', req);
        await auditService.logAction({
          userId: null,
          action: 'login',
          resource: 'auth',
          status: 'failure',
          errorMessage: 'invalid_password',
          ipAddress: req.auditContext?.ipAddress,
          userAgent: req.auditContext?.userAgent,
          metadata: { attemptedEmail: email },
        });
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
      }
    }

    const fresh = await User.findById(user._id).select(
      'role twoFactorEnabled firstName lastName email phone cabinNumber country dateOfBirth preferences allowedModules mustChangePassword userData'
    );
    if (!fresh) {
      logFailedLogin(email, 'user_not_found', req);
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    user = fresh;

    if (user.role === 'admin' && user.twoFactorEnabled) {
      const tfa = (req.body.twoFactorToken || req.header('x-2fa-token') || '').replace(/\s/g, '');
      if (!tfa) {
        const twoFactorChallenge = generateTwoFactorChallengeToken(user._id, user.email);
        return res.status(200).json({
          requiresTwoFactor: true,
          twoFactorChallenge,
          message: 'Code 2FA requis (application d’authentification ou code de secours).',
        });
      }
      const secureUser = await User.findById(user._id).select('+twoFactorSecret +twoFactorBackupCodes');
      const okTotp = secureUser.twoFactorSecret && authService.verifyTOTPToken(secureUser.twoFactorSecret, tfa);
      const backupRes = okTotp ? { valid: false } : await authService.validateBackupCode(secureUser, tfa);
      if (!okTotp && !backupRes.valid) {
        logFailedLogin(email, 'invalid_2fa', req);
        await auditService.logAction({
          userId: user._id,
          action: 'login',
          resource: 'auth',
          status: 'failure',
          errorMessage: 'invalid_2fa',
          ipAddress: req.auditContext?.ipAddress,
          userAgent: req.auditContext?.userAgent,
          metadata: { attemptedEmail: email },
        });
        return res.status(401).json({ message: 'Code 2FA invalide' });
      }
      if (backupRes.valid) {
        secureUser.twoFactorBackupCodes.splice(backupRes.index, 1);
        await secureUser.save();
      }
    }

    const userForLogin = await User.findById(user._id).select(
      'firstName lastName email role phone cabinNumber country dateOfBirth preferences allowedModules mustChangePassword userData twoFactorEnabled'
    );
    userForLogin.lastLogin = new Date();
    await userForLogin.save();

    const tokenPayload = {
      id: userForLogin._id,
      email: userForLogin.email,
      role: userForLogin.role,
    };
    if (userForLogin.role === 'admin' && userForLogin.twoFactorEnabled) {
      tokenPayload.mfa = true;
    }
    const token = generateToken(tokenPayload);

    res.cookie('authToken', token, getCookieOptions(req));

    if (userForLogin.role === 'admin') {
      await auditService.logAction({
        userId: userForLogin._id,
        action: 'login',
        resource: 'auth',
        status: 'success',
        ipAddress: req.auditContext?.ipAddress,
        userAgent: req.auditContext?.userAgent,
      });
    }

    res.json({
      message: 'Login successful',
      user: {
        id: userForLogin._id,
        firstName: userForLogin.firstName,
        lastName: userForLogin.lastName,
        email: userForLogin.email,
        role: userForLogin.role,
        phone: userForLogin.phone,
        cabinNumber: userForLogin.cabinNumber,
        country: userForLogin.country,
        dateOfBirth: userForLogin.dateOfBirth,
        preferences: userForLogin.preferences,
        allowedModules: userForLogin.allowedModules,
        mustChangePassword: !!userForLogin.mustChangePassword,
        twoFactorEnabled: !!userForLogin.twoFactorEnabled,
        userData: userForLogin.userData || {
          favorites: { magazineIds: [], restaurantIds: [], enfantIds: [], watchlist: [], shopItems: [] },
          playbackPositions: {},
        },
      },
    });
  } catch (error) {
    logApiError('Login error', { err: error.message, email: req.body?.email });
    res.status(500).json({ message: 'Server error during login' });
  }
});

// @route   POST /api/auth/logout
// @desc    Invalide la session (supprime le cookie authToken, blacklist JWT)
// @access  Public
router.post('/logout', async (req, res) => {
  const token = req.cookies?.authToken || req.header('Authorization')?.replace('Bearer ', '');
  if (token && cacheManager.isConnected) {
    try {
      const decoded = verifyToken(token);
      const ttl = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 7 * 24 * 60 * 60;
      if (ttl > 0) {
        await cacheManager.set(`blacklist:${token}`, '1', ttl);
      }
    } catch (e) {
      // Token invalide ou expiré, pas besoin de blacklister
    }
  }
  res.clearCookie('authToken', { path: '/', httpOnly: true });
  res.json({ message: 'Logged out successfully' });
});

// @route   POST /api/auth/2fa/complete-login
// @desc    Finalise la connexion admin après mot de passe (challenge JWT + TOTP ou code de secours)
// @access  Public (challenge signé)
router.post('/2fa/complete-login', auditContext, loginLimiter, async (req, res) => {
  try {
    const { twoFactorChallenge, token } = req.body;
    if (!twoFactorChallenge || !token) {
      return res.status(400).json({ message: 'twoFactorChallenge et token requis' });
    }
    let decoded;
    try {
      decoded = verifyTwoFactorChallengeToken(twoFactorChallenge);
    } catch (e) {
      return res.status(401).json({ message: 'Challenge 2FA invalide ou expiré' });
    }
    const userId = decoded.sub || decoded.id;
    const user = await User.findById(userId).select(
      '+twoFactorSecret +twoFactorBackupCodes role email firstName lastName phone cabinNumber country dateOfBirth preferences allowedModules mustChangePassword userData twoFactorEnabled isActive'
    );
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Utilisateur introuvable ou inactif' });
    }
    if (user.role !== 'admin' || !user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA non actif pour ce compte' });
    }
    const tfa = String(token).replace(/\s/g, '');
    const okTotp = user.twoFactorSecret && authService.verifyTOTPToken(user.twoFactorSecret, tfa);
    const backupRes = okTotp ? { valid: false } : await authService.validateBackupCode(user, tfa);
    if (!okTotp && !backupRes.valid) {
      logFailedLogin(user.email, 'invalid_2fa_challenge', req);
      await auditService.logAction({
        userId: user._id,
        action: 'login',
        resource: 'auth',
        status: 'failure',
        errorMessage: 'invalid_2fa_challenge',
        ipAddress: req.auditContext?.ipAddress,
        userAgent: req.auditContext?.userAgent,
        metadata: { attemptedEmail: user.email },
      });
      return res.status(401).json({ message: 'Code 2FA invalide' });
    }
    if (backupRes.valid) {
      user.twoFactorBackupCodes.splice(backupRes.index, 1);
    }
    user.lastLogin = new Date();
    await user.save();
    await invalidateAuthUserCache(user._id);
    const authTok = generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
      mfa: true,
    });
    res.cookie('authToken', authTok, getCookieOptions(req));

    await auditService.logAction({
      userId: user._id,
      action: 'login',
      resource: 'auth',
      status: 'success',
      ipAddress: req.auditContext?.ipAddress,
      userAgent: req.auditContext?.userAgent,
      metadata: { mfa: true },
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        cabinNumber: user.cabinNumber,
        country: user.country,
        dateOfBirth: user.dateOfBirth,
        preferences: user.preferences,
        allowedModules: user.allowedModules,
        mustChangePassword: !!user.mustChangePassword,
        twoFactorEnabled: true,
        userData: user.userData || {
          favorites: { magazineIds: [], restaurantIds: [], enfantIds: [], watchlist: [], shopItems: [] },
          playbackPositions: {},
        },
      },
    });
  } catch (error) {
    logApiError('2fa complete-login', { err: error.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/2fa/setup
// @desc    Génère secret TOTP + QR + codes de secours (non actif tant que /verify non appelé)
// @access  Private admin
router.post('/2fa/setup', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const u = await User.findById(req.user.id).select(
      '+twoFactorPendingSecret +twoFactorPendingBackupHashes email twoFactorEnabled'
    );
    if (u.twoFactorEnabled) {
      return res.status(400).json({ message: 'Le 2FA est déjà activé pour ce compte.' });
    }
    const secret = authService.generateTOTPSecret(u.email);
    const backupPlain = authService.generateBackupCodes(10);
    const backupHashes = await authService.hashBackupCodes(backupPlain);
    u.twoFactorPendingSecret = secret.base32;
    u.twoFactorPendingBackupHashes = backupHashes;
    await u.save();
    await invalidateAuthUserCache(u._id);
    const qrCodeDataUrl = await authService.qrCodeDataUrl(secret.otpauth_url);
    res.json({
      message:
        'Scannez le QR avec une application TOTP, puis validez avec POST /api/auth/2fa/verify (body: { token }). Conservez les codes de secours.',
      qrCodeDataUrl,
      manualEntryKey: secret.base32,
      backupCodes: backupPlain,
    });
  } catch (error) {
    logApiError('2fa setup', { err: error.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/2fa/verify
// @desc    Active le 2FA après validation du premier TOTP
// @access  Private admin
router.post('/2fa/verify', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const raw = String(req.body.token || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(raw)) {
      return res.status(400).json({ message: 'Token TOTP à 6 chiffres requis (champ token)' });
    }
    const u = await User.findById(req.user.id).select('+twoFactorPendingSecret twoFactorPendingBackupHashes');
    if (!u.twoFactorPendingSecret) {
      return res.status(400).json({ message: 'Aucune configuration en cours. Appelez POST /api/auth/2fa/setup.' });
    }
    if (!authService.verifyTOTPToken(u.twoFactorPendingSecret, raw)) {
      return res.status(401).json({ message: 'Code TOTP invalide' });
    }
    u.twoFactorSecret = u.twoFactorPendingSecret;
    u.twoFactorEnabled = true;
    u.twoFactorBackupCodes = Array.isArray(u.twoFactorPendingBackupHashes) ? [...u.twoFactorPendingBackupHashes] : [];
    u.twoFactorPendingSecret = null;
    u.twoFactorPendingBackupHashes = [];
    await u.save();
    await invalidateAuthUserCache(u._id);
    const newTok = generateToken({
      id: u._id,
      email: u.email,
      role: u.role,
      mfa: true,
    });
    res.cookie('authToken', newTok, getCookieOptions(req));
    res.json({
      message: '2FA activé. Les codes de secours ont été fournis lors du setup — ils ne seront plus affichés.',
      twoFactorEnabled: true,
      backupCodes: [],
    });
  } catch (error) {
    logApiError('2fa verify', { err: error.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/2fa/disable
// @desc    Désactive le 2FA (mot de passe + TOTP requis ; session pleine MFA requise via JWT ou en-tête)
// @access  Private admin
router.post('/2fa/disable', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { password, twoFactorToken } = req.body;
    if (!password || !twoFactorToken) {
      return res.status(400).json({ message: 'password et twoFactorToken requis' });
    }
    const u = await User.findById(req.user.id).select('+password +twoFactorSecret twoFactorEnabled');
    if (!u.twoFactorEnabled) {
      return res.status(400).json({ message: 'Le 2FA n’est pas activé.' });
    }
    if (!(await u.comparePassword(password))) {
      return res.status(401).json({ message: 'Mot de passe incorrect' });
    }
    if (!authService.verifyTOTPToken(u.twoFactorSecret, twoFactorToken)) {
      return res.status(401).json({ message: 'Code 2FA invalide' });
    }
    u.twoFactorSecret = null;
    u.twoFactorEnabled = false;
    u.twoFactorBackupCodes = [];
    u.twoFactorPendingSecret = null;
    u.twoFactorPendingBackupHashes = [];
    await u.save();
    await invalidateAuthUserCache(u._id);
    const newTok = generateToken({
      id: u._id,
      email: u.email,
      role: u.role,
    });
    res.cookie('authToken', newTok, getCookieOptions(req));
    res.json({ message: '2FA désactivé', twoFactorEnabled: false });
  } catch (error) {
    logApiError('2fa disable', { err: error.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/refresh
// @desc    Renvoie un nouveau token dans le cookie httpOnly pour prolonger la session
// @access  Private (token valide requis)
// [SEC-4] JWT uniquement dans le cookie, pas dans le body
router.post('/refresh', authMiddleware, (req, res) => {
  try {
    const raw = getTokenFromRequest(req);
    const dec = verifyToken(raw);
    const payload = {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
    };
    if (dec.mfa === true) {
      payload.mfa = true;
    }
    const newToken = generateToken(payload);
    res.cookie('authToken', newToken, getCookieOptions(req));
    res.json({ message: 'Token refreshed' });
  } catch (e) {
    res.status(401).json({ message: 'Token invalide' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const json = user.toObject ? user.toObject() : user;
    json.mustChangePassword = !!user.mustChangePassword;
    json.twoFactorEnabled = !!user.twoFactorEnabled;
    delete json.twoFactorSecret;
    delete json.twoFactorBackupCodes;
    delete json.twoFactorPendingSecret;
    delete json.twoFactorPendingBackupHashes;
    res.json(json);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
// [Q1] Validation des champs (longueurs, format téléphone, date ISO, etc.)
router.put('/profile', authMiddleware, profileValidation, async (req, res) => {
  try {
    const { firstName, lastName, phone, cabinNumber, country, dateOfBirth, preferences } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields (email cannot be changed)
    if (firstName !== undefined) {
      user.firstName = firstName;
    }
    if (lastName !== undefined) {
      user.lastName = lastName;
    }
    if (phone !== undefined) {
      user.phone = phone;
    }
    if (cabinNumber !== undefined) {
      user.cabinNumber = cabinNumber;
    }
    if (country !== undefined) {
      user.country = country;
    }
    if (dateOfBirth !== undefined) {
      user.dateOfBirth = dateOfBirth;
    }
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        cabinNumber: user.cabinNumber,
        country: user.country,
        dateOfBirth: user.dateOfBirth,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error during profile update' });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change user password (current + new)
// @access  Private
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Mot de passe actuel et nouveau mot de passe requis' });
    }
    if (String(newPassword).trim().length < 8) {
      return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
    }
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(400).json({ message: 'Mot de passe actuel incorrect' });
    }
    user.password = newPassword.trim();
    user.mustChangePassword = false;
    await user.save();
    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Erreur lors du changement de mot de passe' });
  }
});

// @route   GET /api/auth/user-data
// @desc    Get user favorites and playback positions (for sync after login / cache clear)
// @access  Private
router.get('/user-data', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('userData').lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const data = user.userData || {};
    const favorites = data.favorites || {
      magazineIds: [],
      restaurantIds: [],
      enfantIds: [],
      watchlist: [],
      shopItems: [],
    };
    const playbackPositions = data.playbackPositions || {};
    res.json({ favorites, playbackPositions });
  } catch (error) {
    console.error('Get user-data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/user-data
// @desc    Save user favorites and/or playback positions
// @access  Private
router.put('/user-data', authMiddleware, async (req, res) => {
  try {
    const { favorites, playbackPositions } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!user.userData || typeof user.userData !== 'object') {
      user.userData = {};
    }
    // [Q2] Limiter chaque tableau de favoris à 500 éléments max
    const FAVORITES_MAX = 500;
    const cap = (arr) => (Array.isArray(arr) ? arr.slice(0, FAVORITES_MAX) : []);
    if (favorites !== undefined) {
      const prev = user.userData.favorites || {};
      user.userData.favorites = {
        magazineIds: cap(Array.isArray(favorites.magazineIds) ? favorites.magazineIds : prev.magazineIds),
        restaurantIds: cap(Array.isArray(favorites.restaurantIds) ? favorites.restaurantIds : prev.restaurantIds),
        enfantIds: cap(Array.isArray(favorites.enfantIds) ? favorites.enfantIds : prev.enfantIds),
        watchlist: cap(Array.isArray(favorites.watchlist) ? favorites.watchlist : prev.watchlist),
        shopItems: cap(Array.isArray(favorites.shopItems) ? favorites.shopItems : prev.shopItems),
      };
    }
    if (playbackPositions !== undefined && typeof playbackPositions === 'object' && playbackPositions !== null) {
      user.userData.playbackPositions = playbackPositions;
    }
    user.markModified('userData');
    await user.save();
    res.json({
      message: 'User data saved',
      favorites: user.userData.favorites,
      playbackPositions: user.userData.playbackPositions,
    });
  } catch (error) {
    console.error('Put user-data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
