import { describe, it, expect } from 'vitest';
import { formatTrend } from './formatTrend';

describe('formatTrend', () => {
  it('renvoie un tiret pour une valeur non numérique', () => {
    expect(formatTrend(undefined)).toBe('—');
    expect(formatTrend('abc')).toBe('—');
    expect(formatTrend(NaN)).toBe('—');
  });

  it('interprète null comme 0 (Number(null))', () => {
    expect(formatTrend(null)).toBe('0%');
  });

  it('formate zéro', () => {
    expect(formatTrend(0)).toBe('0%');
    expect(formatTrend('0')).toBe('0%');
  });

  it('ajoute un + pour les valeurs positives', () => {
    expect(formatTrend(12.5)).toBe('+12.5%');
    expect(formatTrend('3')).toBe('+3%');
  });

  it('garde le signe pour les valeurs négatives', () => {
    expect(formatTrend(-7)).toBe('-7%');
    expect(formatTrend('-2')).toBe('-2%');
  });
});
