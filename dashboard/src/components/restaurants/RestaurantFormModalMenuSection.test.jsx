import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RestaurantFormModalMenuSection from './RestaurantFormModalMenuSection';
import { emptyMenuTranslations } from '../../utils/i18n';

/** Formulaire minimal pour le smoke test section menu */
function buildForm(overrides = {}) {
  const base = {
    newRestaurant: { menu: [] },
    activeLang: 'fr',
    newMenuItem: {
      name: '',
      description: '',
      price: '',
      image: '',
      category: 'main',
      isPopular: false,
      translations: emptyMenuTranslations(),
    },
    setNewMenuItem: vi.fn(),
    menuItemImagePreview: null,
    handleMenuItemImageUpload: vi.fn(),
    removeMenuItemImage: vi.fn(),
    uploadingMenuItemImage: false,
    editingMenuItemId: null,
    addMenuItem: vi.fn(),
    openEditMenuItem: vi.fn(),
    cancelEditMenuItem: vi.fn(),
    removeMenuItem: vi.fn(),
  };
  const merged = { ...base, ...overrides };
  if (overrides.newRestaurant) {
    merged.newRestaurant = { ...base.newRestaurant, ...overrides.newRestaurant };
  }
  if (overrides.newMenuItem) {
    merged.newMenuItem = { ...base.newMenuItem, ...overrides.newMenuItem };
  }
  return merged;
}

const t = vi.fn((key) => key);

describe('RestaurantFormModalMenuSection', () => {
  it('affiche le titre de section', () => {
    render(<RestaurantFormModalMenuSection t={t} form={buildForm()} />);
    expect(screen.getByRole('heading', { name: 'restaurants.menu' })).toBeInTheDocument();
  });

  it('affiche les plats et appelle removeMenuItem', () => {
    const removeMenuItem = vi.fn();
    const form = buildForm({
      removeMenuItem,
      newRestaurant: {
        menu: [
          {
            id: 55,
            name: 'Tarte',
            price: 8,
            category: 'dessert',
            translations: emptyMenuTranslations(),
          },
        ],
      },
    });
    render(<RestaurantFormModalMenuSection t={t} form={form} />);
    expect(screen.getByText('Tarte')).toBeInTheDocument();
    expect(screen.getByText(/€8/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'restaurants.removeFromMenu' }));
    expect(removeMenuItem).toHaveBeenCalledWith(55);
  });

  it('appelle addMenuItem depuis le bouton d’ajout au menu', () => {
    const addMenuItem = vi.fn();
    render(<RestaurantFormModalMenuSection t={t} form={buildForm({ addMenuItem })} />);
    fireEvent.click(screen.getByRole('button', { name: 'restaurants.addToMenu' }));
    expect(addMenuItem).toHaveBeenCalledTimes(1);
  });

  it('appelle openEditMenuItem depuis le bouton modifier', () => {
    const openEditMenuItem = vi.fn();
    const item = {
      id: 99,
      name: 'Soupe',
      price: 4,
      category: 'appetizer',
      translations: emptyMenuTranslations(),
    };
    const form = buildForm({
      openEditMenuItem,
      newRestaurant: { menu: [item] },
    });
    render(<RestaurantFormModalMenuSection t={t} form={form} />);
    fireEvent.click(screen.getByRole('button', { name: 'restaurants.editMenuItem' }));
    expect(openEditMenuItem).toHaveBeenCalledWith(item);
  });
});
