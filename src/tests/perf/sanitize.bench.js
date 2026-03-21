/**
 * Benchmarks Vitest — coût CPU de la sanitization HTML (chemin magazine / XSS).
 *
 *   npm run test:bench
 */
import { bench, describe } from 'vitest';
import { sanitizeArticleContent } from '../../utils/sanitize.js';

const SHORT_HTML = '<p>Hello <strong>world</strong> <a href="https://example.com">link</a></p>';

const LONG_HTML = Array.from({ length: 40 }, (_, i) => {
  const safe =
    i % 3 === 0 ? `<h2>Section ${i}</h2>` : `<p>Paragraph ${i} with <em>emphasis</em> and <code>code</code>.</p>`;
  return safe;
}).join('\n');

describe('sanitizeArticleContent (DOMPurify)', () => {
  bench('fragment court (~120 car.)', () => {
    sanitizeArticleContent(SHORT_HTML);
  });

  bench('article long (~4k car.)', () => {
    sanitizeArticleContent(LONG_HTML);
  });

  bench('entrée vide (early return)', () => {
    sanitizeArticleContent('   ');
  });
});
