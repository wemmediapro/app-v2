import { describe, it, expect } from 'vitest';
import { getFormLabel, MENU_CATEGORY_LABELS } from './restaurantLabels';

describe('getFormLabel', () => {
  it('retourne le libellé pour la langue demandée', () => {
    expect(getFormLabel('en', 'shipLabel')).toBe('Ship');
    expect(getFormLabel('fr', 'shipLabel')).toBe('Bateau');
  });

  it('retombe sur le français si la langue est inconnue', () => {
    expect(getFormLabel('zz', 'shipLabel')).toBe('Bateau');
  });

  it('retombe sur la clé si absente partout', () => {
    expect(getFormLabel('fr', 'unknownKeyThatDoesNotExist')).toBe('unknownKeyThatDoesNotExist');
  });
});

describe('MENU_CATEGORY_LABELS', () => {
  it('expose main pour chaque langue du dashboard', () => {
    expect(MENU_CATEGORY_LABELS.main.fr).toBeTruthy();
    expect(MENU_CATEGORY_LABELS.main.en).toBeTruthy();
  });
});
