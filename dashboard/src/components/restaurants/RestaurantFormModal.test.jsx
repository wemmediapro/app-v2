import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RestaurantFormModal from './RestaurantFormModal';
import { buildRestaurantFormMock } from '../../tests/buildRestaurantFormMock';

const t = vi.fn((key) => key);

describe('RestaurantFormModal', () => {
  it('rend le dialog avec les sections principales', () => {
    const boatConfig = { shipName: 'MS Modal' };
    render(
      <RestaurantFormModal
        onClose={vi.fn()}
        onSave={vi.fn()}
        editingId={null}
        t={t}
        boatConfig={boatConfig}
        form={buildRestaurantFormMock(boatConfig)}
      />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'restaurants.newRestaurant' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'restaurants.menu' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'restaurants.promotionsLabel' })).toBeInTheDocument();
  });

  it('appelle onClose au clic sur le fond (backdrop)', () => {
    const onClose = vi.fn();
    render(
      <RestaurantFormModal
        onClose={onClose}
        onSave={vi.fn()}
        editingId={null}
        t={t}
        boatConfig={{ shipName: 'X' }}
        form={buildRestaurantFormMock()}
      />
    );
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ne ferme pas au clic dans la carte du modal', () => {
    const onClose = vi.fn();
    render(
      <RestaurantFormModal
        onClose={onClose}
        onSave={vi.fn()}
        editingId={null}
        t={t}
        boatConfig={{ shipName: 'X' }}
        form={buildRestaurantFormMock()}
      />
    );
    fireEvent.click(screen.getByRole('heading', { level: 2 }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ferme au bouton X et enregistre depuis le pied de page', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(
      <RestaurantFormModal
        onClose={onClose}
        onSave={onSave}
        editingId="edit-1"
        t={t}
        boatConfig={{ shipName: 'X' }}
        form={buildRestaurantFormMock()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'restaurants.saveChanges' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
