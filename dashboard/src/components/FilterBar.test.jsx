import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '../contexts/LanguageContext';
import FilterBar from './FilterBar';

function renderFilterBar(overrides = {}) {
  const setCountryFilter = vi.fn();
  const setDestinationFilter = vi.fn();
  const props = {
    countryFilter: 'all',
    destinationFilter: 'all',
    setCountryFilter,
    setDestinationFilter,
    ...overrides,
  };
  render(
    <LanguageProvider>
      <FilterBar {...props} />
    </LanguageProvider>
  );
  return { setCountryFilter, setDestinationFilter, props };
}

describe('FilterBar', () => {
  beforeEach(() => {
    localStorage.setItem('language', 'fr');
  });

  it('affiche les libellés Pays et Destination', () => {
    renderFilterBar();
    expect(screen.getByText('Pays')).toBeInTheDocument();
    expect(screen.getByText('Destination')).toBeInTheDocument();
  });

  it('appelle setCountryFilter avec le nom du pays choisi', () => {
    const { setCountryFilter } = renderFilterBar();
    const [countrySelect] = screen.getAllByRole('combobox');
    fireEvent.change(countrySelect, { target: { value: 'Maroc' } });
    expect(setCountryFilter).toHaveBeenCalledWith('Maroc');
  });

  it('appelle setDestinationFilter avec la valeur de la ligne', () => {
    const { setDestinationFilter } = renderFilterBar();
    const [, destinationSelect] = screen.getAllByRole('combobox');
    fireEvent.change(destinationSelect, { target: { value: 'Tanger - Gênes' } });
    expect(setDestinationFilter).toHaveBeenCalledWith('Tanger - Gênes');
  });

  it('n’affiche pas Réinitialiser si tous les filtres sont à « all »', () => {
    renderFilterBar();
    expect(screen.queryByRole('button', { name: /Réinitialiser/i })).not.toBeInTheDocument();
  });

  it('réinitialise pays et destination au clic', () => {
    const { setCountryFilter, setDestinationFilter } = renderFilterBar({
      countryFilter: 'Maroc',
      destinationFilter: 'Tanger - Gênes',
    });

    fireEvent.click(screen.getByRole('button', { name: /Réinitialiser/i }));

    expect(setCountryFilter).toHaveBeenCalledWith('all');
    expect(setDestinationFilter).toHaveBeenCalledWith('all');
  });
});
