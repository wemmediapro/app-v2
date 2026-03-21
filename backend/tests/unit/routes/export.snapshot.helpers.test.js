const {
  exportSnapshotRateLimitKey,
  approxExportItemCount,
} = require('../../../src/routes/export');

describe('export snapshot — helpers', () => {
  it('exportSnapshotRateLimitKey : utilisateur connecté', () => {
    const req = { user: { id: '507f1f77bcf86cd799439011' }, ip: '1.2.3.4' };
    expect(exportSnapshotRateLimitKey(req)).toBe(
      'export-snapshot:user:507f1f77bcf86cd799439011'
    );
  });

  it('exportSnapshotRateLimitKey : IP seule sans clé', () => {
    const prev = process.env.EXPORT_SNAPSHOT_KEY;
    delete process.env.EXPORT_SNAPSHOT_KEY;
    const req = { query: {}, get: () => undefined, ip: '10.0.0.7' };
    expect(exportSnapshotRateLimitKey(req)).toBe('export-snapshot:ip:10.0.0.7');
    if (prev !== undefined) process.env.EXPORT_SNAPSHOT_KEY = prev;
  });

  it('approxExportItemCount agrège les tableaux', () => {
    const n = approxExportItemCount({
      movies: [1, 2],
      magazine: { data: [1] },
      radio: [],
      banners: [1],
      restaurants: [1, 2, 3],
      shop: [],
      shopPromotions: [1],
      webtv: [1, 2],
      enfant: [],
      shipmap: { decks: [1], services: [] },
      notifications: [1],
    });
    expect(n).toBe(2 + 1 + 1 + 3 + 1 + 2 + 1 + 1);
  });
});
