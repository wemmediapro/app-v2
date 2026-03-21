import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import ErrorBoundary from '../components/ErrorBoundary.jsx';

vi.mock('../lib/sentryPassenger', () => ({
  capturePassengerException: vi.fn(),
  initPassengerSentry: vi.fn(),
}));

function Flaky({ fail }) {
  if (fail) throw new Error('test-crash');
  return <span>ok</span>;
}

describe('ErrorBoundary', () => {
  const ce = console.error;

  afterEach(() => {
    console.error = ce;
  });

  it('affiche le fallback puis récupère après réessayer si l’enfant ne plante plus', () => {
    console.error = vi.fn();
    function Harness() {
      const [fail, setFail] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setFail(false)}>
            fix-child
          </button>
          <ErrorBoundary>
            <Flaky fail={fail} />
          </ErrorBoundary>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/test-crash/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'fix-child' }));
    fireEvent.click(screen.getByRole('button', { name: /réessayer|retry|common\.retry/i }));
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('variant root : propose de recharger la page', () => {
    console.error = vi.fn();
    render(
      <ErrorBoundary variant="root">
        <Flaky fail />
      </ErrorBoundary>
    );
    expect(screen.getByRole('button', { name: /recharger la page/i })).toBeInTheDocument();
  });
});
