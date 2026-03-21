import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingScreen from './LoadingScreen';

describe('LoadingScreen', () => {
  it('affiche un spinner et le texte de chargement', () => {
    const { container } = render(<LoadingScreen />);

    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
