/**
 * Données de secours pour les bannières quand MongoDB est indisponible.
 * Utilise backend/data/banners.json
 */

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(BACKEND_ROOT, 'data');
const BANNERS_FILE = path.join(DATA_DIR, 'banners.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readBanners() {
  ensureDir();
  if (!fs.existsSync(BANNERS_FILE)) return [];
  try {
    const raw = fs.readFileSync(BANNERS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('banners-fallback: read error', e.message);
    return [];
  }
}

function localizeBanner(doc, lang) {
  if (!doc) return doc;
  const out = { ...doc, _id: doc._id?.toString() };
  if (lang && doc.translations && typeof doc.translations === 'object') {
    const fallbackLangs = [lang, 'fr', 'en'].filter((l, i, a) => a.indexOf(l) === i);
    for (const l of fallbackLangs) {
      const t = doc.translations[l];
      if (t) {
        if (t.title) out.title = t.title;
        if (t.description !== undefined) out.description = t.description;
        break;
      }
    }
  }
  return out;
}

module.exports = {
  getAll(lang, page) {
    let list = readBanners().filter(b => b.isActive !== false);
    if (page && String(page).trim()) {
      const pageId = String(page).trim().toLowerCase();
      list = list.filter(b => !b.pages || b.pages.length === 0 || b.pages.includes(pageId));
    }
    return list.map(b => localizeBanner(b, lang));
  },
  getById(id, lang) {
    const list = readBanners();
    const b = list.find(x => String(x._id) === String(id));
    return b ? localizeBanner(b, lang) : null;
  },
};
