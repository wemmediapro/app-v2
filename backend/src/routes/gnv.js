/**
 * Routes API GNV - Liste des navires (MongoDB)
 * Anciennes routes info, routes, promotions, weather supprimées.
 */
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Ship = require('../models/Ship');

/** Formate un navire pour la réponse API (id = slug ou _id, route = chaîne) */
function toShipResponse(doc) {
  if (!doc) return null;
  const d = doc.toObject ? doc.toObject() : { ...doc };
  const id = d.slug || (d._id && d._id.toString());
  const routeStr = Array.isArray(d.routes) && d.routes.length > 0
    ? `${d.routes[0].from || ''} - ${d.routes[0].to || ''}`.trim()
    : (d.route || '');
  const out = { ...d, id, _id: d._id && d._id.toString(), route: routeStr };
  if (d.passengers != null || d.capacityVehicles != null || d.capacityCabins != null) {
    out.capacity = {
      passengers: d.passengers ?? d.capacity,
      vehicles: d.capacityVehicles,
      cabins: d.capacityCabins
    };
  }
  return out;
}

/**
 * GET /api/gnv/ships
 * Liste des navires (actifs).
 */
router.get('/ships', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        timestamp: new Date().toISOString()
      });
    }
    const ships = await Ship.find({ isActive: true }).sort({ name: 1 }).lean();
    const data = ships.map((d) => toShipResponse(d));
    res.json({
      success: true,
      data,
      count: data.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erreur route /api/gnv/ships:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des navires',
      error: error.message
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
        message: 'Base de données indisponible'
      });
    }
    const { id } = req.params;
    const bySlug = await Ship.findOne({ slug: id, isActive: true }).lean();
    if (bySlug) {
      return res.json({
        success: true,
        data: toShipResponse(bySlug),
        timestamp: new Date().toISOString()
      });
    }
    if (mongoose.Types.ObjectId.isValid(id)) {
      const byId = await Ship.findOne({ _id: id, isActive: true }).lean();
      if (byId) {
        return res.json({
          success: true,
          data: toShipResponse(byId),
          timestamp: new Date().toISOString()
        });
      }
    }
    res.status(404).json({
      success: false,
      message: 'Navire non trouvé'
    });
  } catch (error) {
    console.error('Erreur route /api/gnv/ships/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du navire',
      error: error.message
    });
  }
});

module.exports = router;
