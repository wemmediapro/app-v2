/** isomorphic-dompurify tire une chaîne ESM incompatible Jest sans transform — mock minimal des cas critiques. */
jest.mock('isomorphic-dompurify', () => ({
  sanitize: (input, _opts) => {
    if (input == null) return '';
    let s = String(input);
    s = s.replace(/<script\b[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '');
    s = s.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    return s;
  },
}));

const { sanitizeMagazineHtml, sanitizeArticlePayload } = require('../../../src/lib/sanitize-article-html');

describe('sanitize-article-html', () => {
  it('retire les scripts et iframes', () => {
    const raw = '<p>ok</p><script>alert(1)</script><iframe src="evil"></iframe>';
    const out = sanitizeMagazineHtml(raw);
    expect(out).toContain('ok');
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/<iframe/i);
  });

  it('sanitizeArticlePayload nettoie content et translations', () => {
    const body = sanitizeArticlePayload({
      title: 'T',
      content: '<b>x</b><img src=x onerror=alert(1)>',
      translations: { en: { content: '<p>a</p><script>x</script>' } },
    });
    expect(body.content).toContain('x');
    expect(body.content).not.toMatch(/onerror/i);
    expect(body.translations.en.content).toContain('a');
    expect(body.translations.en.content).not.toMatch(/<script/i);
  });
});
