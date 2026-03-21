/**
 * Résout l’ID navire depuis l’API boatConfig puis charge useShipmap.
 */
import { useState, useEffect, useMemo } from 'react';
import { apiService } from '../services/apiService';
import { useShipmap } from './useShipmap';
import { currentShip } from '../data/ships';

export function useShipmapFromBoatConfig(language, t) {
  const [shipmapShipId, setShipmapShipId] = useState(7);

  useEffect(() => {
    let cancelled = false;
    apiService
      .getBoatConfig()
      .then((res) => {
        if (cancelled) return;
        const data = res?.data?.data ?? res?.data ?? {};
        const id = data.shipId != null && data.shipId >= 1 ? Number(data.shipId) : 7;
        setShipmapShipId(id);
      })
      .catch(() => {
        if (!cancelled) setShipmapShipId(7);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shipmap = useShipmap(language, t, shipmapShipId);
  const currentShipName = useMemo(() => shipmap.currentShipName || currentShip.name, [shipmap.currentShipName]);

  return { shipmap, currentShipName };
}
