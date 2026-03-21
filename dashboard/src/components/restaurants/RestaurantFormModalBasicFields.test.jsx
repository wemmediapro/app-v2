import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RestaurantFormModalBasicFields from './RestaurantFormModalBasicFields';
import { createEmptyRestaurantForm } from '../../utils/restaurantModalDefaults';

const boatConfig = { shipName: 'MS Test Ship' };

function buildForm(overrides = {}) {
  const empty = createEmptyRestaurantForm(boatConfig);
  const base = {
    newRestaurant: empty,
    setNewRestaurant: vi.fn(),
    activeLang: 'fr',
    setActiveLang: vi.fn(),
    imageFile: null,
    imagePreview: null,
    handleImageUpload: vi.fn(),
    removeImage: vi.fn(),
    newSpecialty: '',
    setNewSpecialty: vi.fn(),
    addSpecialty: vi.fn(),
    removeSpecialty: vi.fn(),
  };
  const merged = { ...base, ...overrides };
  if (overrides.newRestaurant) {
    merged.newRestaurant = { ...empty, ...overrides.newRestaurant };
  }
  return merged;
}

const t = vi.fn((key) => key);

describe('RestaurantFormModalBasicFields', () => {
  it('affiche le sélecteur de langues et le nom du bateau', () => {
    render(<RestaurantFormModalBasicFields t={t} boatConfig={boatConfig} form={buildForm()} />);
    expect(screen.getByRole('button', { name: /Français/ })).toBeInTheDocument();
    expect(screen.getByText('MS Test Ship')).toBeInTheDocument();
  });

  it('change la langue active au clic', () => {
    const setActiveLang = vi.fn();
    render(<RestaurantFormModalBasicFields t={t} boatConfig={boatConfig} form={buildForm({ setActiveLang })} />);
    fireEvent.click(screen.getByRole('button', { name: /English/ }));
    expect(setActiveLang).toHaveBeenCalledWith('en');
  });

  it('appelle addSpecialty au clic sur Ajouter', () => {
    const addSpecialty = vi.fn();
    render(<RestaurantFormModalBasicFields t={t} boatConfig={boatConfig} form={buildForm({ addSpecialty })} />);
    fireEvent.click(screen.getByRole('button', { name: /^common\.add$/ }));
    expect(addSpecialty).toHaveBeenCalledTimes(1);
  });

  it('retire une spécialité affichée', () => {
    const removeSpecialty = vi.fn();
    const empty = createEmptyRestaurantForm(boatConfig);
    const form = buildForm({
      removeSpecialty,
      newRestaurant: {
        ...empty,
        translations: {
          ...empty.translations,
          fr: { ...empty.translations.fr, specialties: ['Truffe'] },
        },
      },
    });
    render(<RestaurantFormModalBasicFields t={t} boatConfig={boatConfig} form={form} />);
    fireEvent.click(screen.getByRole('button', { name: 'restaurants.removeSpecialty' }));
    expect(removeSpecialty).toHaveBeenCalledWith('Truffe');
  });
});
