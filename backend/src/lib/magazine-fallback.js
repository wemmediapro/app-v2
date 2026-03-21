/**
 * Données de secours pour le magazine quand MongoDB est indisponible.
 * Utilise backend/data/magazine.json
 */

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(BACKEND_ROOT, 'data');
const MAGAZINE_FILE = path.join(DATA_DIR, 'magazine.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readArticles() {
  ensureDir();
  if (!fs.existsSync(MAGAZINE_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(MAGAZINE_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('magazine-fallback: read error', e.message);
    return [];
  }
}

function localizeArticle(article, lang) {
  if (!article) {
    return article;
  }
  const out = { ...article, readTime: article.readingTime || 0 };
  const code = (lang && String(lang).trim().toLowerCase()) || null;
  const t = code && article.translations && article.translations[code];
  if (t) {
    if (t.title) {
      out.title = t.title;
    }
    if (t.excerpt) {
      out.excerpt = t.excerpt;
    }
    if (t.content) {
      out.content = t.content;
    }
  }
  delete out.translations;
  return out;
}

module.exports = {
  getAll(lang) {
    return readArticles()
      .filter((a) => a.isActive !== false && (a.isPublished || a.status === 'published'))
      .map((a) => localizeArticle(a, lang));
  },
  getById(id, lang) {
    const articles = readArticles();
    const article = articles.find((a) => String(a._id) === String(id) && a.isActive !== false);
    return article ? localizeArticle(article, lang) : null;
  },
};
