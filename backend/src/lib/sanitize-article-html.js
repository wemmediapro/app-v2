/**
 * HTML magazine / article : aligné sur le front (sans iframe) — stockage serveur sûr (XSS).
 */
const DOMPurify = require('isomorphic-dompurify');

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'a',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'code',
  'img',
  'figure',
  'figcaption',
  'video',
  'source',
  'span',
  'div',
  'section',
  'article',
];

const ALLOWED_ATTR = [
  'href',
  'src',
  'alt',
  'title',
  'class',
  'width',
  'height',
  'controls',
  'allowfullscreen',
  'allow',
  'loading',
];

function sanitizeMagazineHtml(html) {
  if (typeof html !== 'string') {
    return '';
  }
  const trimmed = html.trim();
  if (!trimmed) {
    return '';
  }
  return DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}

/**
 * Nettoie content (et excerpt si HTML) + translations[lang].content / excerpt.
 */
function sanitizeArticlePayload(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }
  const out = { ...body };
  if (out.content != null) {
    out.content = sanitizeMagazineHtml(String(out.content));
  }
  if (out.excerpt != null && String(out.excerpt).includes('<')) {
    out.excerpt = sanitizeMagazineHtml(String(out.excerpt));
  }
  if (out.translations && typeof out.translations === 'object' && !Array.isArray(out.translations)) {
    const tr = { ...out.translations };
    for (const code of Object.keys(tr)) {
      const t = tr[code];
      if (t && typeof t === 'object') {
        const next = { ...t };
        if (next.content != null) {
          next.content = sanitizeMagazineHtml(String(next.content));
        }
        if (next.excerpt != null && String(next.excerpt).includes('<')) {
          next.excerpt = sanitizeMagazineHtml(String(next.excerpt));
        }
        tr[code] = next;
      }
    }
    out.translations = tr;
  }
  return out;
}

module.exports = {
  sanitizeMagazineHtml,
  sanitizeArticlePayload,
  ALLOWED_TAGS,
  ALLOWED_ATTR,
};
