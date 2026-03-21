import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../contexts/LanguageContext';
import Breadcrumb from './Breadcrumb';

function renderBreadcrumb(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LanguageProvider>
        <Routes>
          <Route path="*" element={<Breadcrumb />} />
        </Routes>
      </LanguageProvider>
    </MemoryRouter>
  );
}

describe('Breadcrumb', () => {
  beforeEach(() => {
    localStorage.removeItem('language');
  });

  it('ne rend rien sur la racine sans segment', () => {
    renderBreadcrumb('/');

    expect(screen.queryByRole('navigation', { name: "Fil d'Ariane" })).not.toBeInTheDocument();
  });

  it('sur /dashboard affiche uniquement le libellé tableau de bord', () => {
    renderBreadcrumb('/dashboard');

    const nav = screen.getByRole('navigation', { name: "Fil d'Ariane" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByText('Tableau de bord')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tableau de bord' })).not.toBeInTheDocument();
  });

  it('sur /dashboard/users relie l’accueil et la page courante', () => {
    renderBreadcrumb('/dashboard/users');

    const homeLinks = screen.getAllByRole('link', { name: 'Tableau de bord' });
    expect(homeLinks.length).toBeGreaterThanOrEqual(1);
    expect(homeLinks.every((a) => a.getAttribute('href') === '/dashboard')).toBe(true);
    expect(screen.getByText('Utilisateurs')).toBeInTheDocument();
  });

  it('dédoublonne les segments identiques consécutifs', () => {
    renderBreadcrumb('/dashboard/dashboard/users');

    expect(screen.getAllByText('Tableau de bord').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Utilisateurs')).toBeInTheDocument();
  });
});
