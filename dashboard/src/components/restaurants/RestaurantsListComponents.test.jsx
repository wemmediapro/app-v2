import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RestaurantAdminCard from './RestaurantAdminCard';
import RestaurantsPromotionsStrip from './RestaurantsPromotionsStrip';
import { RestaurantsListLoading, RestaurantsListEmpty } from './RestaurantsListPlaceholders';

function mockTranslate(key, params = {}) {
  if (key === 'restaurants.promotionsCount') {
    return `${params.count} promotion(s) à bord`;
  }
  const map = {
    'common.actions': 'Actions',
    'common.edit': 'Modifier',
    'common.duplicate': 'Dupliquer',
    'common.delete': 'Supprimer',
    'restaurants.dishes': 'plats',
    'restaurants.promos': 'promos',
    'restaurants.noRestaurants': 'Aucun restaurant',
    'restaurants.noRestaurantsHint': 'Ajoutez votre premier établissement',
    'shop.promotions': 'Promotions',
    'restaurants.noPromotionsHint': 'Aucune promotion. Ouvrez un restaurant pour en ajouter.',
  };
  return map[key] ?? key;
}

const t = vi.fn(mockTranslate);

describe('RestaurantsListLoading', () => {
  it('affiche un indicateur de chargement', () => {
    render(<RestaurantsListLoading />);
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
  });
});

describe('RestaurantsListEmpty', () => {
  it('affiche les messages via t()', () => {
    render(<RestaurantsListEmpty t={t} />);
    expect(screen.getByText('Aucun restaurant')).toBeInTheDocument();
    expect(screen.getByText('Ajoutez votre premier établissement')).toBeInTheDocument();
  });
});

describe('RestaurantAdminCard', () => {
  const baseRestaurant = {
    _id: 'r1',
    name: 'Le Neptune',
    type: 'Brasserie',
    location: 'Pont 7',
    priceRange: '€€',
    rating: 4.2,
    menu: [{ id: 1 }, { id: 2 }],
    promotions: [{ id: 1 }],
  };

  function renderCard(overrides = {}) {
    const setActionMenuOpen = vi.fn();
    const onEdit = vi.fn();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    const utils = render(
      <RestaurantAdminCard
        restaurant={{ ...baseRestaurant, ...overrides }}
        t={t}
        actionMenuOpen={null}
        setActionMenuOpen={setActionMenuOpen}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    );
    return { ...utils, setActionMenuOpen, onEdit, onDuplicate, onDelete };
  }

  it('affiche le nom, le type et le nombre de plats', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Le Neptune' })).toBeInTheDocument();
    expect(screen.getByText('Brasserie')).toBeInTheDocument();
    expect(screen.getByText(/2 plats/)).toBeInTheDocument();
    expect(screen.getByText(/1 promos/)).toBeInTheDocument();
  });

  it('ouvre le menu et déclenche onEdit', () => {
    const { onEdit, setActionMenuOpen, rerender } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    expect(setActionMenuOpen).toHaveBeenCalledWith('r1');

    rerender(
      <RestaurantAdminCard
        restaurant={baseRestaurant}
        t={t}
        actionMenuOpen="r1"
        setActionMenuOpen={setActionMenuOpen}
        onEdit={onEdit}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(onEdit).toHaveBeenCalledWith(baseRestaurant);
  });

  it('affiche un tiret si pas de localisation', () => {
    renderCard({ location: '' });
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('Dupliquer et Supprimer appellent les handlers', () => {
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    const setActionMenuOpen = vi.fn();
    const { rerender } = render(
      <RestaurantAdminCard
        restaurant={baseRestaurant}
        t={t}
        actionMenuOpen={null}
        setActionMenuOpen={setActionMenuOpen}
        onEdit={vi.fn()}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    rerender(
      <RestaurantAdminCard
        restaurant={baseRestaurant}
        t={t}
        actionMenuOpen="r1"
        setActionMenuOpen={setActionMenuOpen}
        onEdit={vi.fn()}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dupliquer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(onDuplicate).toHaveBeenCalledWith(baseRestaurant);
    expect(onDelete).toHaveBeenCalledWith(baseRestaurant);
  });
});

describe('RestaurantsPromotionsStrip', () => {
  const onEditRestaurant = vi.fn();

  beforeEach(() => {
    onEditRestaurant.mockClear();
  });

  it('ne rend rien en chargement', () => {
    const { container } = render(
      <RestaurantsPromotionsStrip
        restaurants={[{ _id: '1', name: 'R' }]}
        restaurantsLoading
        t={t}
        onEditRestaurant={onEditRestaurant}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('ne rend rien si la liste est vide', () => {
    const { container } = render(
      <RestaurantsPromotionsStrip
        restaurants={[]}
        restaurantsLoading={false}
        t={t}
        onEditRestaurant={onEditRestaurant}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('affiche le hint sans promotions', () => {
    render(
      <RestaurantsPromotionsStrip
        restaurants={[{ _id: '1', name: 'R', promotions: [] }]}
        restaurantsLoading={false}
        t={t}
        onEditRestaurant={onEditRestaurant}
      />
    );
    expect(screen.getByText('Promotions')).toBeInTheDocument();
    expect(screen.getByText('Aucune promotion. Ouvrez un restaurant pour en ajouter.')).toBeInTheDocument();
  });

  it('liste les promotions et ouvre l’édition du bon restaurant', () => {
    const r = {
      _id: 'rid',
      name: 'La Voile',
      promotions: [{ id: 10, title: 'Menu midi', price: 12, originalPrice: 15, discount: 20 }],
    };
    render(
      <RestaurantsPromotionsStrip
        restaurants={[r]}
        restaurantsLoading={false}
        t={t}
        onEditRestaurant={onEditRestaurant}
      />
    );
    expect(screen.getByText('1 promotion(s) à bord')).toBeInTheDocument();
    expect(screen.getByText('La Voile')).toBeInTheDocument();
    expect(screen.getByText('Menu midi')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Modifier' })[0]);
    expect(onEditRestaurant).toHaveBeenCalledWith(r);
  });

  it('agrège les promotions de plusieurs restaurants', () => {
    const r1 = {
      _id: 'a',
      name: 'Resto A',
      promotions: [{ id: 1, title: 'Promo A', price: 5 }],
    };
    const r2 = {
      _id: 'b',
      name: 'Resto B',
      promotions: [
        { id: 2, title: 'Promo B1', price: 6 },
        { id: 3, title: 'Promo B2', price: 7 },
      ],
    };
    render(
      <RestaurantsPromotionsStrip
        restaurants={[r1, r2]}
        restaurantsLoading={false}
        t={t}
        onEditRestaurant={onEditRestaurant}
      />
    );
    expect(screen.getByText('3 promotion(s) à bord')).toBeInTheDocument();
    expect(screen.getByText('Promo A')).toBeInTheDocument();
    expect(screen.getByText('Promo B1')).toBeInTheDocument();
    expect(screen.getByText('Promo B2')).toBeInTheDocument();
    const editButtons = screen.getAllByRole('button', { name: 'Modifier' });
    expect(editButtons).toHaveLength(3);
    fireEvent.click(editButtons[1]);
    expect(onEditRestaurant).toHaveBeenCalledWith(r2);
  });
});
