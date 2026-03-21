import { describe, it, expect } from 'vitest';
import { LANG_LIST } from './i18n';
import { createEmptyRestaurantForm, emptyNewMenuItemState, emptyNewPromotionState } from './restaurantModalDefaults';

describe('restaurantModalDefaults', () => {
  it('createEmptyRestaurantForm remplit shipName depuis boatConfig', () => {
    const form = createEmptyRestaurantForm({ shipName: 'Bateau A' });
    expect(form.shipName).toBe('Bateau A');
    expect(form.menu).toEqual([]);
    expect(form.promotions).toEqual([]);
    expect(form.category).toBe('french');
    expect(form.rating).toBe(4.5);
  });

  it('createEmptyRestaurantForm sans config garde shipName vide', () => {
    expect(createEmptyRestaurantForm(undefined).shipName).toBe('');
  });

  it('createEmptyRestaurantForm expose une traduction par langue', () => {
    const form = createEmptyRestaurantForm({ shipName: '' });
    LANG_LIST.forEach(({ code }) => {
      expect(form.translations[code]).toBeDefined();
    });
  });

  it('emptyNewMenuItemState retourne un nouvel objet à chaque appel', () => {
    const a = emptyNewMenuItemState();
    const b = emptyNewMenuItemState();
    expect(a).not.toBe(b);
    expect(a.category).toBe('main');
    expect(a.translations).toBeDefined();
  });

  it('emptyNewPromotionState retourne un nouvel objet à chaque appel', () => {
    const a = emptyNewPromotionState();
    const b = emptyNewPromotionState();
    expect(a).not.toBe(b);
    expect(a.translations).toBeDefined();
  });
});
