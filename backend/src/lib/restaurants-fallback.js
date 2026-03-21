/**
 * Données de secours pour les restaurants quand MongoDB est indisponible.
 * Utilise backend/data/restaurants.json
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const BACKEND_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(BACKEND_ROOT, 'data');
const RESTAURANTS_FILE = path.join(DATA_DIR, 'restaurants.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readRestaurants() {
  ensureDir();
  if (!fs.existsSync(RESTAURANTS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(RESTAURANTS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    logger.warn({ event: 'restaurants_fallback_read_failed', err: e.message });
    return [];
  }
}

function localizeRestaurant(doc, lang) {
  if (!doc) {
    return doc;
  }
  const normalizedLang = (lang && String(lang).toLowerCase()) || '';
  const out = { ...doc };
  if (normalizedLang && doc.translations && doc.translations[normalizedLang]) {
    const t = doc.translations[normalizedLang];
    if (t.name) {
      out.name = t.name;
    }
    if (t.description) {
      out.description = t.description;
    }
    if (t.type) {
      out.type = t.type;
    }
    if (t.location) {
      out.location = t.location;
    }
    if (t.openingHours) {
      out.openingHours = t.openingHours;
    }
    if (Array.isArray(t.specialties)) {
      out.specialties = t.specialties;
    }
    if (Array.isArray(out.menu) && Array.isArray(t.menu)) {
      out.menu = out.menu.map((item, idx) => {
        const tr = t.menu[idx];
        return {
          ...item,
          name: tr && tr.name ? tr.name : item.name,
          description: tr && tr.description ? tr.description : item.description,
        };
      });
    }
    if (Array.isArray(t.promotions) && Array.isArray(out.promotions) && t.promotions.length === out.promotions.length) {
      out.promotions = out.promotions.map((p, idx) => ({
        ...p,
        title: t.promotions[idx] && t.promotions[idx].title ? t.promotions[idx].title : p.title,
        description: t.promotions[idx] && t.promotions[idx].description ? t.promotions[idx].description : p.description,
      }));
    }
  }
  return out;
}

module.exports = {
  getAll(lang) {
    return readRestaurants()
      .filter((r) => r.isActive !== false)
      .map((r) => localizeRestaurant(r, lang));
  },
  getById(id, lang) {
    const list = readRestaurants();
    const r = list.find((x) => String(x._id) === String(id));
    return r ? localizeRestaurant(r, lang) : null;
  },
};
