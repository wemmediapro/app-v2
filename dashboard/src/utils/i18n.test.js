import { describe, it, expect } from 'vitest';
import {
  LANG_LIST,
  emptyTranslationsAll,
  emptyMenuTranslations,
  emptyPromotionTranslations,
  emptyTranslations,
} from './i18n';

describe('i18n dashboard', () => {
  it('LANG_LIST a des codes uniques', () => {
    const codes = LANG_LIST.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('emptyTranslationsAll couvre chaque langue de LANG_LIST', () => {
    const all = emptyTranslationsAll();
    LANG_LIST.forEach(({ code }) => {
      expect(all).toHaveProperty(code);
    });
  });

  it('emptyMenuTranslations et emptyPromotionTranslations ont la même liste de langues', () => {
    const menu = emptyMenuTranslations();
    const promo = emptyPromotionTranslations();
    expect(Object.keys(menu).sort()).toEqual(Object.keys(promo).sort());
    expect(Object.keys(menu).sort()).toEqual(LANG_LIST.map((l) => l.code).sort());
  });

  it('emptyTranslations ne contient pas le français (champs racine FR)', () => {
    const t = emptyTranslations();
    expect(t).not.toHaveProperty('fr');
    expect(t).toHaveProperty('en');
  });
});
