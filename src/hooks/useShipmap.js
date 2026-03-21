/**
 * Hook Shipmap : plan du navire — ponts, deckServices, refetch. Extrait d'App.jsx (REFACTORING-APP.md).
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { gnvShipsList } from '../data/ships';

function deckTypeToIcon(type) {
  const t = (type || '').toLowerCase();
  if (t === 'vehicle') return '🚗';
  if (t === 'cabin') return '🛏️';
  if (t === 'service') return '🍽️';
  if (t === 'public') return '☀️';
  return '📋';
}

const DEFAULT_SHIP_ID = 7;

export function useShipmap(language, t, shipmapShipId = DEFAULT_SHIP_ID) {
  const [gnvShips, setGnvShips] = useState(gnvShipsList);
  const [currentShipName, setCurrentShipName] = useState(gnvShipsList[0]?.name || '');
  const [shipmapDecks, setShipmapDecks] = useState([]);
  const [shipmapLoading, setShipmapLoading] = useState(true);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [shipSearchQuery, setShipSearchQuery] = useState('');
  const [shipmapDeckTypeFilter, setShipmapDeckTypeFilter] = useState('all');
  const [showShipmapAddPlanModal, setShowShipmapAddPlanModal] = useState(false);

  const effectiveShipId = Number(shipmapShipId);
  const shipIdForApi = Number.isNaN(effectiveShipId) || effectiveShipId < 1 ? DEFAULT_SHIP_ID : effectiveShipId;

  const shipmapShip = useMemo(() => {
    if (gnvShips.length > 0) {
      const s = gnvShips[0];
      return { id: s.id, name: s.name, route: s.route || '' };
    }
    return { name: 'GNV Excellent', route: 'Gênes - Palerme' };
  }, [gnvShips]);

  const refetchShipmap = useCallback(async () => {
    setShipmapLoading(true);
    try {
      const res = await apiService.getShipmapDecks(`shipId=${shipIdForApi}&lang=${language || 'fr'}`);
      const list = Array.isArray(res?.data) ? res.data : res?.data?.decks || [];
      setShipmapDecks(list);
      if (list.length > 0) {
        setSelectedDeck((prev) => {
          if (!prev || !list.some((d) => (d._id || d.id) === prev)) return list[0]._id || list[0].id;
          return prev;
        });
      }
    } catch (e) {
      setShipmapDecks([]);
    } finally {
      setShipmapLoading(false);
    }
  }, [shipIdForApi, language]);

  useEffect(() => {
    refetchShipmap();
  }, [refetchShipmap]);

  useEffect(() => {
    let cancelled = false;
    apiService
      .getGNVShips?.()
      ?.then((res) => {
        if (cancelled) return;
        const data = res?.data?.data;
        if (Array.isArray(data) && data.length > 0) {
          setGnvShips(
            data.map((s) => ({
              id: s.id || s._id,
              name: s.name,
              route: s.route || (s.routes?.[0] ? `${s.routes[0].from} - ${s.routes[0].to}` : ''),
            }))
          );
          setCurrentShipName(data[0].name);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const shipDecks = useMemo(
    () =>
      shipmapDecks.map((d) => ({
        id: d._id || d.id,
        name: d.name || '',
        label: (d.description || '').slice(0, 40),
        icon: deckTypeToIcon(d.type),
        type: (d.type || '').toLowerCase(),
        color:
          d.type === 'vehicle'
            ? 'bg-slate-100'
            : d.type === 'cabin'
              ? 'bg-blue-100'
              : d.type === 'service'
                ? 'bg-teal-100'
                : 'bg-amber-100',
      })),
    [shipmapDecks]
  );

  const shipDecksFiltered = useMemo(() => {
    if (shipmapDeckTypeFilter === 'all') return shipDecks;
    return shipDecks.filter((d) => d.type === shipmapDeckTypeFilter);
  }, [shipDecks, shipmapDeckTypeFilter]);

  const selectedDeckInfo = useMemo(() => shipDecks.find((d) => d.id === selectedDeck), [shipDecks, selectedDeck]);

  useEffect(() => {
    if (shipDecksFiltered.length > 0 && selectedDeck && !shipDecksFiltered.some((d) => d.id === selectedDeck)) {
      setSelectedDeck(shipDecksFiltered[0].id);
    }
  }, [shipmapDeckTypeFilter, shipDecksFiltered, selectedDeck]);

  const deckServices = useMemo(() => {
    const openLabel = t('shipmap.serviceOpen');
    const closedLabel = t('shipmap.serviceClosed');
    const o = {};
    shipmapDecks.forEach((d) => {
      const id = d._id || d.id;
      o[id] = {
        title: d.name || t('shipmap.deckNumber', { number: id }),
        summary: d.description || '',
        services: (d.services || []).map((s) => {
          const name = typeof s === 'string' ? s : (s?.name ?? '');
          const icon = typeof s === 'object' && s?.icon ? s.icon : '•';
          const details = typeof s === 'object' && s?.openingHours ? s.openingHours : '';
          const isOpen = typeof s === 'object' && s?.isOpen !== undefined ? s.isOpen : true;
          return { title: name, type: 'Service', icon, status: isOpen ? openLabel : closedLabel, details };
        }),
      };
    });
    return o;
  }, [shipmapDecks, t]);

  const deckRooms = useMemo(() => {
    const o = {};
    shipmapDecks
      .filter((d) => d.type === 'cabin')
      .forEach((d) => {
        o[d._id || d.id] = '—';
      });
    return o;
  }, [shipmapDecks]);

  const currentDeck = useMemo(() => {
    if (!selectedDeck) return { title: '', summary: '', services: [] };
    return deckServices[selectedDeck] || { title: '', summary: '', services: [] };
  }, [selectedDeck, deckServices]);

  const filteredDeckServices = useMemo(() => {
    const services = currentDeck.services || [];
    if (!shipSearchQuery || !shipSearchQuery.trim()) return services;
    const query = shipSearchQuery.toLowerCase();
    return services.filter(
      (service) =>
        (service.title && service.title.toLowerCase().includes(query)) ||
        (service.type && service.type.toLowerCase().includes(query)) ||
        (service.details && service.details.toLowerCase().includes(query))
    );
  }, [currentDeck, shipSearchQuery]);

  return {
    gnvShips,
    currentShipName,
    shipmapShip,
    shipmapDecks,
    shipmapLoading,
    selectedDeck,
    setSelectedDeck,
    shipSearchQuery,
    setShipSearchQuery,
    shipmapDeckTypeFilter,
    setShipmapDeckTypeFilter,
    showShipmapAddPlanModal,
    setShowShipmapAddPlanModal,
    refetchShipmap,
    shipDecks,
    shipDecksFiltered,
    selectedDeckInfo,
    deckServices,
    deckRooms,
    filteredDeckServices,
  };
}
