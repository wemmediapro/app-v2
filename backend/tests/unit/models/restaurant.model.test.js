const Restaurant = require('../../../src/models/Restaurant');
const { restaurantValid } = require('../../fixtures');

describe('Restaurant model', () => {
  it('rejette sans name / type / description', () => {
    const r = new Restaurant({});
    const err = r.validateSync();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.type).toBeDefined();
    expect(err.errors.description).toBeDefined();
  });

  it('accepte des données valides', () => {
    const r = new Restaurant(restaurantValid);
    expect(r.validateSync()).toBeUndefined();
  });

  it('rating borné entre 0 et 5', () => {
    const r = new Restaurant({ ...restaurantValid, rating: 10 });
    const err = r.validateSync();
    expect(err.errors.rating).toBeDefined();
  });

  it('priceRange enum', () => {
    const r = new Restaurant({ ...restaurantValid, priceRange: '€€€€€' });
    const err = r.validateSync();
    expect(err.errors.priceRange).toBeDefined();
  });

  it('timestamps activés', () => {
    expect(Restaurant.schema.options.timestamps).toBe(true);
  });
});
