/**
 * Routes API GNV - Liste des navires (MongoDB)
 * Anciennes routes info, routes, promotions, weather supprimées.
 */
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Ship = require('../models/Ship');
const LocalServerConfig = require('../models/LocalServerConfig');
const { authMiddleware, adminMiddleware, optionalAuth } = require('../middleware/auth');
const connectionCounters = require('../lib/connectionCounters');
const { logRouteError } = require('../lib/route-logger');

/** Formate un navire pour la réponse API (id = slug ou _id, route = chaîne) */
function toShipResponse(doc) {
  if (!doc) {
    return null;
  }
  const d = doc.toObject ? doc.toObject() : { ...doc };
  const id = d.slug || (d._id && d._id.toString());
  const routeStr =
    Array.isArray(d.routes) && d.routes.length > 0
      ? `${d.routes[0].from || ''} - ${d.routes[0].to || ''}`.trim()
      : d.route || '';
  const out = { ...d, id, _id: d._id && d._id.toString(), route: routeStr };
  if (d.passengers != null || d.capacityVehicles != null || d.capacityCabins != null) {
    out.capacity = {
      passengers: d.passengers ?? d.capacity,
      vehicles: d.capacityVehicles,
      cabins: d.capacityCabins,
    };
  }
  return out;
}

/**
 * GET /api/gnv/ships
 * Liste des navires (actifs). Avec auth admin et ?all=true : tous les navires (actifs et inactifs).
 */
router.get('/ships', optionalAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        timestamp: new Date().toISOString(),
      });
    }
    const allRequested = req.query.all === 'true' && req.user && req.user.role === 'admin';
    const filter = allRequested ? {} : { isActive: true };
    const ships = await Ship.find(filter).read('secondaryPreferred').sort({ name: 1 }).lean();
    const data = ships.map((d) => {
      const out = toShipResponse(d);
      if (allRequested) {
        out.isActive = d.isActive !== false;
      }
      return out;
    });
    res.json({
      success: true,
      data,
      count: data.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logRouteError(req, 'gnv_ships_list_failed', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des navires',
      error: error.message,
    });
  }
});

/**
 * GET /api/gnv/ships/:id
 * Détail d'un navire par slug ou _id.
 */
router.get('/ships/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Base de données indisponible',
      });
    }
    const { id } = req.params;
    const bySlug = await Ship.findOne({ slug: id, isActive: true }).read('secondaryPreferred').lean();
    if (bySlug) {
      const out = toShipResponse(bySlug);
      return res.json({
        success: true,
        data: out,
        timestamp: new Date().toISOString(),
      });
    }
    if (mongoose.Types.ObjectId.isValid(id)) {
      const byId = await Ship.findOne({ _id: id, isActive: true }).read('secondaryPreferred').lean();
      if (byId) {
        const out = toShipResponse(byId);
        return res.json({
          success: true,
          data: out,
          timestamp: new Date().toISOString(),
        });
      }
    }
    res.status(404).json({
      success: false,
      message: 'Navire non trouvé',
    });
  } catch (error) {
    logRouteError(req, 'gnv_ships_get_failed', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du navire',
      error: error.message,
    });
  }
});

/** Génère un slug à partir d'un nom (pour POST ships) */
function slugify(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * POST /api/gnv/ships
 * Crée un navire (dashboard admin). Corps : { name, slug?, type?, capacity }.
 */
router.post('/ships', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Base de données indisponible',
      });
    }
    const { name, slug: slugInput, type, capacity } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Le nom du navire est requis',
      });
    }
    const capacityNum = typeof capacity === 'number' ? capacity : parseInt(capacity, 10);
    if (Number.isNaN(capacityNum) || capacityNum < 0) {
      return res.status(400).json({
        success: false,
        message: 'La capacité doit être un nombre positif ou zéro',
      });
    }
    let slug = typeof slugInput === 'string' ? slugInput.trim() : '';
    if (!slug) {
      slug = slugify(name);
    }
    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de générer un identifiant (slug) à partir du nom',
      });
    }
    const shipType = ['Ferry', 'Cruise', 'Cargo'].includes(type) ? type : 'Ferry';

    const existing = await Ship.findOne({
      $or: [{ name: name.trim() }, { slug }],
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          existing.slug === slug
            ? 'Un navire avec cet identifiant (slug) existe déjà.'
            : 'Un navire avec ce nom existe déjà.',
      });
    }

    const ship = await Ship.create({
      name: name.trim(),
      slug,
      type: shipType,
      capacity: capacityNum,
      isActive: true,
      status: 'En service',
    });
    const out = toShipResponse(ship.toObject());
    res.status(201).json({
      success: true,
      data: out,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Un navire avec ce nom ou cet identifiant existe déjà.',
      });
    }
    logRouteError(req, 'gnv_ships_create_failed', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du navire',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/gnv/ships/:id
 * Met à jour un navire (dashboard admin). Corps : { name?, slug?, type?, capacity?, maxConnections?, isActive? }.
 */
router.patch('/ships/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Base de données indisponible',
      });
    }
    const { id } = req.params;
    const { name, slug: slugInput, type, capacity, maxConnections, isActive } = req.body;
    const update = {};

    if (typeof name === 'string' && name.trim()) {
      update.name = name.trim();
    }
    if (slugInput !== undefined) {
      const slug = typeof slugInput === 'string' ? slugInput.trim() : '';
      update.slug = slug || undefined;
    }
    if (['Ferry', 'Cruise', 'Cargo'].includes(type)) {
      update.type = type;
    }
    if (typeof capacity === 'number' && capacity >= 0) {
      update.capacity = capacity;
    } else if (capacity !== undefined && capacity !== null && capacity !== '') {
      const capacityNum = parseInt(capacity, 10);
      if (!Number.isNaN(capacityNum) && capacityNum >= 0) {
        update.capacity = capacityNum;
      }
    }
    if (maxConnections === null || maxConnections === undefined || maxConnections === '') {
      update.maxConnections = null;
    } else {
      const maxConn = typeof maxConnections === 'number' ? maxConnections : parseInt(maxConnections, 10);
      if (maxConn != null && !Number.isNaN(maxConn) && maxConn >= 0) {
        update.maxConnections = maxConn;
      }
    }
    if (typeof isActive === 'boolean') {
      update.isActive = isActive;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune modification fournie',
      });
    }

    const query = mongoose.Types.ObjectId.isValid(id) && id.length === 24 ? { _id: id } : { slug: id };
    const updated = await Ship.findOneAndUpdate(query, { $set: update }, { new: true }).lean();

    if (updated) {
      const out = toShipResponse(updated);
      out.isActive = updated.isActive !== false;
      return res.json({
        success: true,
        data: out,
        timestamp: new Date().toISOString(),
      });
    }
    res.status(404).json({
      success: false,
      message: 'Navire non trouvé',
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Un navire avec ce nom ou cet identifiant existe déjà.',
      });
    }
    logRouteError(req, 'gnv_ships_patch_failed', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du navire',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/gnv/ships/:id
 * Désactive un navire (soft delete : isActive = false). Admin uniquement.
 */
router.delete('/ships/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Base de données indisponible',
      });
    }
    const { id } = req.params;
    const query = mongoose.Types.ObjectId.isValid(id) && id.length === 24 ? { _id: id } : { slug: id };
    const updated = await Ship.findOneAndUpdate(query, { $set: { isActive: false } }, { new: true }).lean();
    if (updated) {
      return res.json({
        success: true,
        message: 'Navire désactivé',
        timestamp: new Date().toISOString(),
      });
    }
    res.status(404).json({
      success: false,
      message: 'Navire non trouvé',
    });
  } catch (error) {
    logRouteError(req, 'gnv_ships_delete_failed', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la désactivation du navire',
      error: error.message,
    });
  }
});

/**
 * GET /api/gnv/boat-config
 * Configuration du bateau unique (nom, capacité, informations). Public pour l'app.
 */
router.get('/boat-config', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        data: { shipName: '', shipCapacity: null, shipInfo: '', shipId: 7 },
        timestamp: new Date().toISOString(),
      });
    }
    const config = await LocalServerConfig.findOne({ id: 'local' }).lean();
    const defaultShipId = 7; // GNV Excellent — correspond au seed shipmap
    const data = {
      shipName: config?.shipName ?? '',
      shipCapacity: config?.shipCapacity != null ? config.shipCapacity : null,
      shipInfo: config?.shipInfo ?? '',
      shipId: config?.shipId != null && config.shipId >= 1 ? config.shipId : defaultShipId,
    };
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logRouteError(req, 'gnv_boat_config_get_failed', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la configuration du bateau',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/gnv/boat-config
 * Met à jour la configuration du bateau. Corps : { shipName?, shipCapacity?, shipInfo? }. Admin uniquement.
 */
router.patch('/boat-config', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Base de données indisponible' });
    }
    const { shipName, shipCapacity, shipInfo, shipId } = req.body;
    const update = {};
    if (shipName !== undefined) {
      update.shipName = typeof shipName === 'string' ? shipName.trim() : '';
    }
    if (shipCapacity !== undefined) {
      const val =
        shipCapacity === null || shipCapacity === ''
          ? null
          : typeof shipCapacity === 'number'
            ? shipCapacity
            : parseInt(shipCapacity, 10);
      update.shipCapacity = val != null && !Number.isNaN(val) && val >= 0 ? val : null;
    }
    if (shipInfo !== undefined) {
      update.shipInfo = typeof shipInfo === 'string' ? shipInfo.trim() : '';
    }
    if (shipId !== undefined) {
      const id = typeof shipId === 'number' ? shipId : parseInt(shipId, 10);
      update.shipId = id >= 1 && !Number.isNaN(id) ? id : 7;
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: 'Aucune modification fournie' });
    }
    const config = await LocalServerConfig.findOneAndUpdate(
      { id: 'local' },
      { $set: update },
      { new: true, upsert: true }
    ).lean();
    res.json({
      success: true,
      data: {
        shipName: config.shipName ?? '',
        shipCapacity: config.shipCapacity != null ? config.shipCapacity : null,
        shipInfo: config.shipInfo ?? '',
        shipId: config.shipId != null && config.shipId >= 1 ? config.shipId : 7,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logRouteError(req, 'gnv_boat_config_patch_failed', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la configuration du bateau',
      error: error.message,
    });
  }
});

/**
 * GET /api/gnv/connection-limit
 * Limite de connexions du serveur local (où tourne ce backend). Admin uniquement.
 */
router.get('/connection-limit', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const currentConnections =
      typeof connectionCounters.getTotalCountAsync === 'function'
        ? await connectionCounters.getTotalCountAsync()
        : connectionCounters.getTotalCount
          ? connectionCounters.getTotalCount()
          : 0;
    let maxConnections = null;
    if (mongoose.connection.readyState === 1) {
      const config = await LocalServerConfig.findOne({ id: 'local' }).lean();
      maxConnections = config?.maxConnections != null ? config.maxConnections : null;
    }
    res.json({
      success: true,
      data: { currentConnections, maxConnections },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logRouteError(req, 'gnv_connection_limit_get_failed', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la limite',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/gnv/connection-limit
 * Définit la limite de connexions du serveur local. Corps : { maxConnections?: number | null }.
 */
router.patch('/connection-limit', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Base de données indisponible' });
    }
    const { maxConnections } = req.body;
    const value =
      maxConnections === null || maxConnections === undefined || maxConnections === ''
        ? null
        : typeof maxConnections === 'number'
          ? maxConnections
          : parseInt(maxConnections, 10);
    if (value !== null && (Number.isNaN(value) || value < 0)) {
      return res
        .status(400)
        .json({ success: false, message: 'maxConnections doit être un nombre positif ou null (illimité)' });
    }
    const config = await LocalServerConfig.findOneAndUpdate(
      { id: 'local' },
      { $set: { maxConnections: value } },
      { new: true, upsert: true }
    ).lean();
    const currentConnections =
      typeof connectionCounters.getTotalCountAsync === 'function'
        ? await connectionCounters.getTotalCountAsync()
        : connectionCounters.getTotalCount
          ? connectionCounters.getTotalCount()
          : 0;
    res.json({
      success: true,
      data: {
        currentConnections,
        maxConnections: config.maxConnections != null ? config.maxConnections : null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logRouteError(req, 'gnv_connection_limit_patch_failed', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la limite',
      error: error.message,
    });
  }
});

module.exports = router;
