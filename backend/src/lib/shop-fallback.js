/**
 * Données de secours pour la boutique (produits + promotions) quand MongoDB est indisponible.
 * Utilise backend/data/shop.json (format: { products: [], promotions: [] })
 */

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(BACKEND_ROOT, 'data');
const SHOP_FILE = path.join(DATA_DIR, 'shop.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readShop() {
  ensureDir();
  if (!fs.existsSync(SHOP_FILE)) {
    return { products: [], promotions: [] };
  }
  try {
    const raw = fs.readFileSync(SHOP_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      products: Array.isArray(data.products) ? data.products : [],
      promotions: Array.isArray(data.promotions) ? data.promotions : [],
    };
  } catch (e) {
    console.warn('shop-fallback: read error', e.message);
    return { products: [], promotions: [] };
  }
}

function localizeProduct(doc, lang) {
  if (!doc) {
    return doc;
  }
  const out = {
    ...doc,
    id: doc._id?.toString(),
    imageUrl: doc.images?.[0]?.url || doc.images?.[0] || '',
    image: doc.images?.[0]?.url || doc.images?.[0] || '',
  };
  if (lang && doc.translations && doc.translations[lang]) {
    const t = doc.translations[lang];
    if (t.name) {
      out.name = t.name;
    }
    if (t.description) {
      out.description = t.description;
    }
  }
  return out;
}

module.exports = {
  getProducts(lang) {
    const { products } = readShop();
    return products.filter((p) => p.isActive !== false).map((p) => localizeProduct(p, lang));
  },
  getProductById(id, lang) {
    const { products } = readShop();
    const p = products.find((x) => String(x._id) === String(id));
    return p ? localizeProduct(p, lang) : null;
  },
  getPromotions() {
    const { promotions } = readShop();
    return promotions.map((p) => ({
      ...p,
      id: p._id?.toString(),
      validFrom:
        p.validFrom && (typeof p.validFrom === 'string' ? p.validFrom : p.validFrom.toISOString?.()?.slice(0, 10)),
      validUntil:
        p.validUntil && (typeof p.validUntil === 'string' ? p.validUntil : p.validUntil.toISOString?.()?.slice(0, 10)),
    }));
  },
};
