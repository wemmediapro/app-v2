/**
 * Sanitization Socket.io (XSS) — send-message payload.
 * isomorphic-dompurify + jsdom utilisent de l’ESM dans la chaîne de deps : on mocke DOMPurify ici
 * et on teste la logique d’enveloppe (types, pièce jointe, trim).
 */
jest.mock('isomorphic-dompurify', () => ({
  sanitize: (input, _opts) =>
    String(input)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ''),
}));

jest.mock('../../../src/lib/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
}));

const { sanitizeContent, sanitizeSocketAttachment } = require('../../../src/socket/handlers');

describe('socket handlers — sanitizeContent', () => {
  it('retire les balises script et conserve le texte', () => {
    expect(sanitizeContent('<script>alert(1)</script>hello')).toBe('hello');
  });

  it('neutralise les événements inline courants', () => {
    expect(sanitizeContent('<img src=x onerror=alert(1)>x')).not.toMatch(/onerror/i);
    expect(sanitizeContent('<img src=x onerror=alert(1)>x')).toContain('x');
  });

  it('accepte null / undefined comme chaîne vide', () => {
    expect(sanitizeContent(null)).toBe('');
    expect(sanitizeContent(undefined)).toBe('');
  });
});

describe('socket handlers — sanitizeSocketAttachment', () => {
  it('retourne undefined pour un objet (pas de stringification implicite)', () => {
    expect(sanitizeSocketAttachment({ url: 'http://x' })).toBeUndefined();
  });

  it('sanitise une chaîne comme le corps du message', () => {
    expect(sanitizeSocketAttachment('<b>pic</b>')).toBe('pic');
  });

  it('retourne undefined pour chaîne vide après purge', () => {
    expect(sanitizeSocketAttachment('   ')).toBeUndefined();
    expect(sanitizeSocketAttachment('<script></script>')).toBeUndefined();
  });
});
