import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Users, Utensils } from 'lucide-react';
import DashboardStatGrid from './DashboardStatGrid';

describe('DashboardStatGrid', () => {
  it('affiche le titre de section et les cartes', () => {
    const statCards = [
      {
        title: 'Utilisateurs test',
        value: 42,
        change: '—',
        changeType: 'neutral',
        icon: Users,
        color: 'blue',
      },
      {
        title: 'Restaurants test',
        value: 3,
        change: '+2%',
        changeType: 'positive',
        icon: Utensils,
        color: 'green',
      },
    ];

    render(
      <DashboardStatGrid statCards={statCards} sectionHeading="Bloc stats test" vsLastMonthLabel="vs mois dernier" />
    );

    expect(screen.getByRole('heading', { name: 'Bloc stats test' })).toBeInTheDocument();
    expect(screen.getByText('Utilisateurs test')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Restaurants test')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('+2%')).toBeInTheDocument();
    expect(screen.getAllByText('vs mois dernier')).toHaveLength(2);
  });
});
