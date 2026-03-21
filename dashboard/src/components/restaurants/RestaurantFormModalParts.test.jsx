import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RestaurantFormModalHeader from './RestaurantFormModalHeader';
import RestaurantFormModalFooter from './RestaurantFormModalFooter';
import RestaurantFormModalOpenStatus from './RestaurantFormModalOpenStatus';

const t = vi.fn((key) => {
  const map = {
    'restaurants.editRestaurant': 'Modifier le restaurant',
    'restaurants.newRestaurant': 'Nouveau restaurant',
    'restaurants.modalSubtitleEdit': 'Modifier les informations',
    'restaurants.modalSubtitleNew': 'Créer un nouvel établissement',
    'common.close': 'Fermer',
    'restaurants.restaurantOpenLabel': 'Restaurant ouvert',
    'common.cancel': 'Annuler',
    'restaurants.saveRestaurant': 'Enregistrer le restaurant',
    'restaurants.saveChanges': 'Enregistrer les modifications',
  };
  return map[key] ?? key;
});

describe('RestaurantFormModalHeader', () => {
  it('affiche le titre création lorsque editingId est absent', () => {
    render(<RestaurantFormModalHeader editingId={null} t={t} onClose={() => {}} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Nouveau restaurant');
    expect(screen.getByText('Créer un nouvel établissement')).toBeInTheDocument();
  });

  it('affiche le titre édition lorsque editingId est défini', () => {
    render(<RestaurantFormModalHeader editingId="abc123" t={t} onClose={() => {}} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Modifier le restaurant');
    expect(screen.getByText('Modifier les informations')).toBeInTheDocument();
  });

  it('appelle onClose au clic sur le bouton fermer', () => {
    const onClose = vi.fn();
    render(<RestaurantFormModalHeader editingId={null} t={t} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

function OpenStatusHarness({ initialOpen = true }) {
  const [newRestaurant, setNewRestaurant] = useState({ isOpen: initialOpen });
  return (
    <>
      <RestaurantFormModalOpenStatus t={t} form={{ newRestaurant, setNewRestaurant }} />
      <span data-testid="is-open-flag">{String(newRestaurant.isOpen)}</span>
    </>
  );
}

describe('RestaurantFormModalFooter', () => {
  it('affiche Enregistrer le restaurant en création', () => {
    render(<RestaurantFormModalFooter editingId={null} t={t} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByRole('button', { name: 'Enregistrer le restaurant' })).toBeInTheDocument();
  });

  it('affiche Enregistrer les modifications en édition', () => {
    render(<RestaurantFormModalFooter editingId="id1" t={t} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByRole('button', { name: 'Enregistrer les modifications' })).toBeInTheDocument();
  });

  it('déclenche onClose et onSave', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(<RestaurantFormModalFooter editingId={null} t={t} onClose={onClose} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le restaurant' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

describe('RestaurantFormModalOpenStatus', () => {
  it('reflète isOpen et met à jour au clic', () => {
    render(<OpenStatusHarness initialOpen />);
    const checkbox = screen.getByRole('checkbox', { name: /restaurant ouvert/i });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(screen.getByTestId('is-open-flag')).toHaveTextContent('false');
  });

  it('affiche le libellé traduit', () => {
    render(<OpenStatusHarness />);
    expect(screen.getByText('Restaurant ouvert')).toBeInTheDocument();
  });
});
