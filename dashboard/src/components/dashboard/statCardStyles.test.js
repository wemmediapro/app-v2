import { describe, it, expect } from 'vitest';
import { DASHBOARD_CHART_COLORS, statIconBg, statIconColor } from './statCardStyles';

describe('statCardStyles', () => {
  it('expose une palette de couleurs pour les graphiques', () => {
    expect(DASHBOARD_CHART_COLORS.length).toBeGreaterThan(0);
    expect(DASHBOARD_CHART_COLORS.every((c) => typeof c === 'string' && c.startsWith('#'))).toBe(true);
  });

  it('aligne les clés de fond et de texte des icônes', () => {
    expect(Object.keys(statIconBg).sort()).toEqual(Object.keys(statIconColor).sort());
  });

  it('référence des classes Tailwind pour chaque variante', () => {
    for (const [key, bg] of Object.entries(statIconBg)) {
      expect(bg).toMatch(/^bg-/);
      expect(statIconColor[key]).toMatch(/^text-/);
    }
  });
});
