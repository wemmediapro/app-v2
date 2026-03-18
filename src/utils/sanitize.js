/**
 * Sanitization HTML pour affichage sûr (ex. contenu magazine) — prévention XSS.
 * Nécessite la dépendance : npm install dompurify
 */
import DOMPurify from 'dompurify';

/**
 * Sanitize HTML for safe use with dangerouslySetInnerHTML (e.g. magazine article content).
 * Allows safe tags/attributes; strips scripts, event handlers, and javascript: URLs.
 */
export function sanitizeArticleContent(html) {
  if (typeof html !== 'string') return '';
  const trimmed = html.trim();
  if (!trimmed) return '';

  return DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
      'img', 'figure', 'figcaption', 'video', 'source', 'iframe',
      'span', 'div', 'section', 'article',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'width', 'height', 'controls', 'allowfullscreen', 'allow'],
  });
}
