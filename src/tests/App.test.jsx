import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingFallback from '../components/LoadingFallback';

describe('Frontend unit tests', () => {
  it('test setup works', () => {
    expect(true).toBe(true);
  });

  it('LoadingFallback renders with default text', () => {
    render(<LoadingFallback />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Chargement/)).toBeInTheDocument();
  });

  it('LoadingFallback uses t() when provided', () => {
    const t = (key) => (key === 'common.loading' ? 'Loading…' : key);
    render(<LoadingFallback t={t} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});
