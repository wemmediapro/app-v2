const { facetCount } = require('../../../src/services/analyticsAggregations');

describe('analyticsAggregations.facetCount', () => {
  it('retourne 0 pour tableau vide ou absent', () => {
    expect(facetCount(undefined)).toBe(0);
    expect(facetCount([])).toBe(0);
  });

  it('lit c sur le premier élément', () => {
    expect(facetCount([{ c: 7 }])).toBe(7);
  });
});
