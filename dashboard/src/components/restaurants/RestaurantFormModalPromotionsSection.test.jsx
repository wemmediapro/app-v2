import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RestaurantFormModalPromotionsSection from './RestaurantFormModalPromotionsSection';
import { emptyPromotionTranslations } from '../../utils/i18n';

function buildForm(overrides = {}) {
  const base = {
    newRestaurant: { promotions: [] },
    activeLang: 'fr',
    newPromotion: {
      title: '',
      description: '',
      price: '',
      originalPrice: '',
      discount: '',
      validUntil: '',
      translations: emptyPromotionTranslations(),
    },
    setNewPromotion: vi.fn(),
    addPromotion: vi.fn(),
    removePromotion: vi.fn(),
  };
  const merged = { ...base, ...overrides };
  if (overrides.newRestaurant) {
    merged.newRestaurant = { ...base.newRestaurant, ...overrides.newRestaurant };
  }
  if (overrides.newPromotion) {
    merged.newPromotion = { ...base.newPromotion, ...overrides.newPromotion };
  }
  return merged;
}

const t = vi.fn((key) => key);

describe('RestaurantFormModalPromotionsSection', () => {
  it('affiche le titre de section', () => {
    render(<RestaurantFormModalPromotionsSection t={t} form={buildForm()} />);
    expect(screen.getByRole('heading', { name: 'restaurants.promotionsLabel' })).toBeInTheDocument();
  });

  it('affiche les promos et appelle removePromotion', () => {
    const removePromotion = vi.fn();
    const form = buildForm({
      removePromotion,
      newRestaurant: {
        promotions: [
          {
            id: 7,
            title: 'Happy Hour',
            price: 9,
            originalPrice: 12,
            discount: 25,
            translations: {
              ...emptyPromotionTranslations(),
              fr: { title: 'Happy Hour', description: 'Soirée' },
            },
          },
        ],
      },
    });
    render(<RestaurantFormModalPromotionsSection t={t} form={form} />);
    expect(screen.getByText('Happy Hour')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'restaurants.removePromotion' }));
    expect(removePromotion).toHaveBeenCalledWith(7);
  });

  it('appelle addPromotion depuis le bouton', () => {
    const addPromotion = vi.fn();
    render(<RestaurantFormModalPromotionsSection t={t} form={buildForm({ addPromotion })} />);
    fireEvent.click(screen.getByRole('button', { name: 'restaurants.addPromotionButton' }));
    expect(addPromotion).toHaveBeenCalledTimes(1);
  });
});
