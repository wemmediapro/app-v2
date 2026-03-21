import { describe, it, expect } from 'vitest';
import { buildDashboardStatCards } from './buildDashboardStatCards';

describe('buildDashboardStatCards', () => {
  const t = (key) => key;

  it('renvoie 10 cartes avec des titres issus de t()', () => {
    const cards = buildDashboardStatCards(t, null);
    expect(cards).toHaveLength(10);
    expect(cards.map((c) => c.title)).toEqual([
      'dashboard.users',
      'dashboard.viewers',
      'dashboard.restaurants',
      'dashboard.radioStations',
      'dashboard.moviesSeries',
      'dashboard.magazineArticles',
      'dashboard.kidsActivities',
      'dashboard.shopProducts',
      'dashboard.messages',
      'navigation.feedback',
    ]);
  });

  it('utilise 0 quand stats ou statistics est absent', () => {
    const cards = buildDashboardStatCards(t, null);
    expect(cards.every((c) => c.value === 0)).toBe(true);
  });

  it('mappe les compteurs depuis statistics', () => {
    const stats = {
      statistics: {
        totalUsers: 1,
        totalViewers: 2,
        totalRestaurants: 3,
        totalRadioStations: 4,
        totalMovies: 5,
        totalArticles: 6,
        totalActivities: 7,
        totalProducts: 8,
        totalMessages: 9,
        totalFeedback: 10,
      },
    };
    const cards = buildDashboardStatCards(t, stats);
    expect(cards.map((c) => c.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('fixe change à un tiret et changeType à neutral', () => {
    const cards = buildDashboardStatCards(t, { statistics: { totalUsers: 1 } });
    cards.forEach((c) => {
      expect(c.change).toBe('—');
      expect(c.changeType).toBe('neutral');
    });
  });
});
