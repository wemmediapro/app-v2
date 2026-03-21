import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DEFAULT_RESTAURANT_IMAGE, getImageSrc, getRestaurantImageSrc } from './restaurantImages';

describe('restaurantImages', () => {
  const originalOrigin = window.location.origin;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, origin: 'https://dashboard.test' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, origin: originalOrigin },
    });
  });

  describe('getImageSrc', () => {
    it('retourne null pour valeur vide', () => {
      expect(getImageSrc('')).toBeNull();
      expect(getImageSrc(null)).toBeNull();
      expect(getImageSrc(undefined)).toBeNull();
    });

    it('laisse les URLs absolues et data URI inchangées', () => {
      expect(getImageSrc('https://cdn.example/x.png')).toBe('https://cdn.example/x.png');
      expect(getImageSrc('http://local/x')).toBe('http://local/x');
      expect(getImageSrc('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    });

    it('préfixe une URL relative par lorigine', () => {
      expect(getImageSrc('/uploads/a.jpg')).toBe('https://dashboard.test/uploads/a.jpg');
      expect(getImageSrc('uploads/a.jpg')).toBe('https://dashboard.test/uploads/a.jpg');
    });
  });

  describe('getRestaurantImageSrc', () => {
    it('utilise limage par défaut si absente ou vide', () => {
      expect(getRestaurantImageSrc({})).toBe(DEFAULT_RESTAURANT_IMAGE);
      expect(getRestaurantImageSrc({ image: '   ' })).toBe(DEFAULT_RESTAURANT_IMAGE);
    });

    it('résout une image relative comme getImageSrc', () => {
      expect(getRestaurantImageSrc({ image: '/uploads/r.jpg' })).toBe('https://dashboard.test/uploads/r.jpg');
    });
  });
});
