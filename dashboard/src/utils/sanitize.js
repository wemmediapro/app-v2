/**
 * Prévisualisation HTML magazine (dashboard) — même politique que l’app passager (pas d’iframe).
 */
import DOMPurify from 'dompurify';

export function sanitizeArticleContent(html) {
  if (typeof html !== 'string') return '';
  const trimmed = html.trim();
  if (!trimmed) return '';

  return DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS: [
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
    ],
    ALLOWED_ATTR: [
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
    ],
  });
}
