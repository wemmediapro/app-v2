import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

const BoatConfigContext = createContext(null);

export function BoatConfigProvider({ children }) {
  const [boatConfig, setBoatConfig] = useState({
    shipName: '',
    shipCapacity: null,
    shipInfo: ''
  });
  const [loading, setLoading] = useState(true);

  const refreshBoatConfig = useCallback(async () => {
    try {
      const res = await apiService.getBoatConfig();
      const data = res?.data?.data ?? res?.data ?? {};
      setBoatConfig({
        shipName: data.shipName ?? '',
        shipCapacity: data.shipCapacity != null ? data.shipCapacity : null,
        shipInfo: data.shipInfo ?? ''
      });
    } catch (err) {
      console.error('Erreur chargement configuration bateau:', err);
      setBoatConfig({ shipName: '', shipCapacity: null, shipInfo: '' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBoatConfig();
  }, [refreshBoatConfig]);

  const value = {
    boatConfig,
    loading,
    refreshBoatConfig
  };

  return (
    <BoatConfigContext.Provider value={value}>
      {children}
    </BoatConfigContext.Provider>
  );
}

export function useBoatConfig() {
  const ctx = useContext(BoatConfigContext);
  if (!ctx) {
    return {
      boatConfig: { shipName: '', shipCapacity: null, shipInfo: '' },
      loading: false,
      refreshBoatConfig: () => {}
    };
  }
  return ctx;
}
