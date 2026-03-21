import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { apiService } from '../services/apiService';
import { BoatConfigProvider, useBoatConfig } from './BoatConfigContext';

vi.mock('../services/apiService', () => ({
  apiService: {
    getBoatConfig: vi.fn(),
  },
}));

function ConfigProbe() {
  const { boatConfig, loading } = useBoatConfig();
  return (
    <div>
      <span data-testid="loading">{loading ? '1' : '0'}</span>
      <span data-testid="shipName">{boatConfig.shipName}</span>
      <span data-testid="capacity">{boatConfig.shipCapacity ?? ''}</span>
      <span data-testid="info">{boatConfig.shipInfo}</span>
    </div>
  );
}

describe('BoatConfigProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge la config depuis res.data.data', async () => {
    vi.mocked(apiService.getBoatConfig).mockResolvedValue({
      data: {
        data: {
          shipName: 'MS Test',
          shipCapacity: 800,
          shipInfo: 'Pont 9',
        },
      },
    });

    render(
      <BoatConfigProvider>
        <ConfigProbe />
      </BoatConfigProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('0');
    });
    expect(screen.getByTestId('shipName')).toHaveTextContent('MS Test');
    expect(screen.getByTestId('capacity')).toHaveTextContent('800');
    expect(screen.getByTestId('info')).toHaveTextContent('Pont 9');
  });

  it('accepte res.data plat sans enveloppe data', async () => {
    vi.mocked(apiService.getBoatConfig).mockResolvedValue({
      data: { shipName: 'Seul niveau', shipCapacity: null, shipInfo: '' },
    });

    render(
      <BoatConfigProvider>
        <ConfigProbe />
      </BoatConfigProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('0');
    });
    expect(screen.getByTestId('shipName')).toHaveTextContent('Seul niveau');
  });

  it('en erreur remet une config vide', async () => {
    vi.mocked(apiService.getBoatConfig).mockRejectedValue(new Error('fail'));

    render(
      <BoatConfigProvider>
        <ConfigProbe />
      </BoatConfigProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('0');
    });
    expect(screen.getByTestId('shipName')).toHaveTextContent('');
    expect(screen.getByTestId('capacity')).toHaveTextContent('');
  });
});

describe('useBoatConfig hors provider', () => {
  it('renvoie des valeurs par défaut', () => {
    function Outside() {
      const { boatConfig, loading, refreshBoatConfig } = useBoatConfig();
      return (
        <span>
          {loading ? 'l' : 'n'}-{boatConfig.shipName}-{typeof refreshBoatConfig}
        </span>
      );
    }
    render(<Outside />);
    expect(screen.getByText('n--function')).toBeInTheDocument();
  });
});
