import { describe, it, expect } from 'vitest';
import { restaurantToFormState } from './restaurantFormState';

describe('restaurantToFormState', () => {
  it('copie les champs racine et initialise les traductions FR depuis name/description', () => {
    const state = restaurantToFormState({
      name: 'Le Bistrot',
      description: 'Cuisine du marché',
      type: 'Café & Snacks',
      category: 'french',
      menu: [],
      promotions: [],
      specialties: ['Pain'],
    });
    expect(state.name).toBe('Le Bistrot');
    expect(state.description).toBe('Cuisine du marché');
    expect(state.specialties).toEqual(['Pain']);
    expect(state.translations.fr.name).toBe('Le Bistrot');
    expect(state.translations.fr.description).toBe('Cuisine du marché');
    expect(state.translations.fr.specialties).toEqual(['Pain']);
    expect(state.translations.en.type).toBe('Café & Snacks');
  });

  it('mappe un plat du menu et les entrées menu par langue', () => {
    const state = restaurantToFormState({
      name: 'R',
      description: 'D',
      type: 'Steakhouse',
      category: 'french',
      menu: [{ id: 9, name: 'Steak', description: 'Rare', price: 22, category: 'main' }],
      promotions: [],
      translations: {
        fr: {
          name: 'R',
          description: 'D',
          type: 'Steakhouse',
          category: 'french',
          specialties: [],
          menu: [{ name: 'Steak FR', description: 'Rare FR' }],
        },
        en: {
          name: 'R',
          description: 'D',
          type: 'Steakhouse',
          category: 'french',
          specialties: [],
          menu: [{ name: 'Steak EN', description: 'Rare EN' }],
        },
      },
    });
    expect(state.menu).toHaveLength(1);
    expect(state.menu[0].id).toBe(9);
    expect(state.menu[0].translations.fr.name).toBe('Steak FR');
    expect(state.menu[0].translations.en.name).toBe('Steak EN');
  });

  it('assigne id index+1 si le plat na pas did', () => {
    const state = restaurantToFormState({
      name: 'R',
      description: 'D',
      type: 'Steakhouse',
      category: 'french',
      menu: [{ name: 'X', price: 1 }],
      promotions: [],
    });
    expect(state.menu[0].id).toBe(1);
  });

  it('mappe les promotions avec traductions par index', () => {
    const state = restaurantToFormState({
      name: 'R',
      description: 'D',
      type: 'Steakhouse',
      category: 'french',
      menu: [],
      promotions: [{ id: 1, title: 'Happy', description: 'Midi', price: 10 }],
      translations: {
        fr: {
          name: 'R',
          description: 'D',
          type: 'Steakhouse',
          category: 'french',
          specialties: [],
          promotions: [{ title: 'Happy FR', description: 'Midi FR' }],
        },
      },
    });
    expect(state.promotions[0].translations.fr.title).toBe('Happy FR');
  });
});
