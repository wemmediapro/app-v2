const {
  compressionRequestFilter,
  resetCompressionStats,
  getCompressionStats,
} = require('../../../src/lib/http-middleware-tuning');

function makeRes(headers = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [String(k).toLowerCase(), v]));
  return {
    getHeader(name) {
      return lower[String(name).toLowerCase()];
    },
  };
}

describe('compressionRequestFilter', () => {
  beforeEach(() => {
    resetCompressionStats();
  });

  it('refuse si x-no-compression', () => {
    const req = { headers: { 'x-no-compression': '1' }, path: '/api/x' };
    const res = makeRes({ 'Content-Type': 'application/json' });
    expect(compressionRequestFilter(req, res)).toBe(false);
    expect(getCompressionStats().skippedNoCompressionHeader).toBe(1);
  });

  it('refuse si Content-Encoding déjà défini', () => {
    const req = { headers: {}, path: '/api/x' };
    const res = makeRes({ 'Content-Encoding': 'gzip', 'Content-Type': 'application/json' });
    expect(compressionRequestFilter(req, res)).toBe(false);
    expect(getCompressionStats().skippedAlreadyEncoded).toBe(1);
  });

  it('refuse les chemins .png / .jpg / .jpeg', () => {
    const req = { headers: {}, path: '/uploads/photo.JPEG' };
    const res = makeRes();
    expect(compressionRequestFilter(req, res)).toBe(false);
    expect(getCompressionStats().skippedPngJpegPath).toBe(1);
  });

  it('refuse image/png et image/jpeg (Content-Type)', () => {
    const req = { headers: {}, path: '/dynamic' };
    const res = makeRes({ 'Content-Type': 'image/jpeg; charset=binary' });
    expect(compressionRequestFilter(req, res)).toBe(false);
    expect(getCompressionStats().skippedPngJpegContentType).toBe(1);
  });

  it('délègue au filtre par défaut pour application/json', () => {
    const req = { headers: {}, path: '/api/list' };
    const res = makeRes({ 'Content-Type': 'application/json' });
    expect(compressionRequestFilter(req, res)).toBe(true);
    expect(getCompressionStats().defaultFilterTrue).toBe(1);
  });
});
