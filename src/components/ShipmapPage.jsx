import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Map,
  Search,
  Layers,
  Compass,
  Waves,
  ChevronDown,
  Truck,
  Car,
  ArrowUpFromLine,
  UtensilsCrossed,
  Coffee,
  Sun,
  BedDouble,
  DoorOpen,
  CircleDot,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getRadioLogoUrl } from '../services/apiService';

/** Retourne l'icône Lucide adaptée au libellé du service (garage, ascenseur, restaurant, etc.) */
function getServiceIcon(title) {
  if (!title || typeof title !== 'string') return CircleDot;
  const t = title.toLowerCase();
  if (t.includes('poids lourd') || t.includes('camion') || t.includes('heavy')) return Truck;
  if (t.includes('véhicule') || t.includes('vehicle') || t.includes('léger') || t.includes('light') || t.includes('voiture')) return Car;
  if (t.includes('ascenseur') || t.includes('elevator') || t.includes('lift') || t.includes('escalier') || t.includes('stair')) return ArrowUpFromLine;
  if (t.includes('restaurant') || t.includes('ristorante') || t.includes('resto')) return UtensilsCrossed;
  if (t.includes('bar') || t.includes('café') || t.includes('cafe') || t.includes('snack')) return Coffee;
  if (t.includes('piscine') || t.includes('pool')) return Waves;
  if (t.includes('cabine') || t.includes('cabin') || t.includes('chambre') || t.includes('room')) return BedDouble;
  if (t.includes('pont soleil') || t.includes('sun deck') || t.includes('terrasse')) return Sun;
  if (t.includes('accès') || t.includes('access') || t.includes('entrée') || t.includes('entree')) return DoorOpen;
  return CircleDot;
}

const DECK_TYPE_FILTERS = [
  { value: 'all', labelKey: 'filterAll', icon: '📋' },
  { value: 'cabin', labelKey: 'filterCabin', icon: '🛏️' },
  { value: 'service', labelKey: 'filterService', icon: '🍽️' },
  { value: 'vehicle', labelKey: 'filterVehicle', icon: '🚗' },
  { value: 'public', labelKey: 'filterPublic', icon: '☀️' },
];

export default function ShipmapPage({
  t: tProp,
  shipmapShip,
  shipmapLoading,
  refetchShipmap,
  shipDecks,
  shipDecksFiltered,
  selectedDeck,
  setSelectedDeck,
  shipmapDeckTypeFilter,
  setShipmapDeckTypeFilter,
  shipSearchQuery,
  setShipSearchQuery,
  deckServices,
  selectedDeckInfo,
  filteredDeckServices,
  deckRooms,
}) {
  const { t: tContext } = useLanguage();
  const t = tProp ?? tContext;
  const deckInfo = selectedDeck ? deckServices[selectedDeck] : null;
  const totalServices = shipDecks.reduce((acc, d) => acc + (deckServices[d.id]?.services?.length || 0), 0);
  const filtersToShow = DECK_TYPE_FILTERS.filter(
    (f) => f.value === 'all' || shipDecks.some((d) => d.type === f.value)
  );

  return (
    <motion.div
      key="shipmap"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100/80"
    >
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-5 lg:px-6 py-5 sm:py-6 space-y-6 sm:space-y-7 pb-28">
        {/* En-tête — même style que Magazine / Shop (bloc bleu #264FFF) */}
        <header className="rounded-2xl overflow-hidden shadow-lg bg-[#264FFF] px-5 py-4 sm:px-6 sm:py-5 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex-shrink-0">
              <Map size={24} className="text-white sm:w-7 sm:h-7" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">{t('shipmap.title')}</h1>
              <p className="text-xs sm:text-sm text-white/90 mt-0.5 line-clamp-2">{shipmapShip.name}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-white/80">
                <Compass size={14} className="opacity-90" />
                {shipmapShip.route}
              </p>
              {!shipmapLoading && shipDecks.length > 0 && (
                <p className="text-xs text-white/80 mt-1.5">
                  {shipDecks.length} {t('shipmap.decks')} · {totalServices} {t('shipmap.services')}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Filtres par type de pont — style Magazine (boutons blanc / slate-900) */}
        {!shipmapLoading && shipDecks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filtersToShow.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setShipmapDeckTypeFilter(f.value)}
                className={`snap-start shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                  shipmapDeckTypeFilter === f.value
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>{f.icon}</span>
                <span>{t(`shipmap.${f.labelKey}`)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Loading — squelette style Magazine */}
        {shipmapLoading && (
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex gap-3">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3" />
                </div>
              </div>
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#264FFF]/20 border-t-[#264FFF]" />
                <p className="ml-3 text-slate-600 text-sm">{t('common.loading')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Contenu avec ponts et détail */}
        {!shipmapLoading && shipDecks.length > 0 && (
          <>
            {/* Choix du pont — menu déroulant */}
            <section className="space-y-2">
              <label htmlFor="shipmap-deck-select" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                <Waves size={12} />
                {t('shipmap.chooseDeck')}
              </label>
              <div className="relative">
                <select
                  id="shipmap-deck-select"
                  value={selectedDeck || (shipDecksFiltered[0]?.id ?? '')}
                  onChange={(e) => setSelectedDeck(e.target.value || null)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3.5 pr-10 text-sm font-medium text-slate-800 shadow-sm transition-colors focus:border-[#264FFF] focus:outline-none focus:ring-2 focus:ring-[#264FFF]/20"
                  aria-label={t('shipmap.chooseDeck')}
                >
                  {shipDecksFiltered.map((deck) => (
                    <option key={deck.id} value={deck.id}>
                      {deck.icon} {deck.name || t('shipmap.deck')}
                    </option>
                  ))}
                </select>
                <ChevronDown size={20} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              </div>
            </section>

            {/* Carte du pont sélectionné — cartes blanches */}
            <AnimatePresence mode="wait">
              {selectedDeck && deckInfo && (
                <motion.section
                  key={selectedDeck}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#264FFF]/10 border border-[#264FFF]/20">
                        <Layers size={20} className="text-[#264FFF]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base font-bold text-slate-900">
                          {deckInfo.title || selectedDeckInfo?.name || t('shipmap.deck')}
                        </h2>
                        {deckInfo.summary && (
                          <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                            {deckInfo.summary}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Services du pont */}
                  <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <span className="text-[#264FFF]">◆</span>
                        {t('shipmap.servicesOnDeck')} {selectedDeckInfo?.name || ''}
                      </h3>
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {filteredDeckServices.length}
                      </span>
                    </div>
                    <div className="p-3 sm:p-4">
                      {filteredDeckServices.length === 0 ? (
                        <div className="rounded-xl bg-slate-50 border border-slate-100 px-6 py-10 text-center">
                          <Search size={28} className="mx-auto text-slate-400" />
                          <p className="mt-2 text-sm font-medium text-slate-600">{t('common.search')}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {shipSearchQuery ? `« ${shipSearchQuery} »` : t('shipmap.discoverServices')}
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {filteredDeckServices.map((service, index) => {
                            const iconUrl = service.icon && service.icon !== '•' ? getRadioLogoUrl(service.icon) : null;
                            const ServiceIcon = getServiceIcon(service.title);
                            return (
                              <motion.li
                                key={`${service.title}-${index}`}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.03 }}
                                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition hover:border-slate-200 hover:bg-slate-50"
                              >
                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 overflow-hidden text-slate-600">
                                  {iconUrl ? (
                                    <img src={iconUrl} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <ServiceIcon size={22} strokeWidth={1.75} className="text-[#264FFF]" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 min-h-[2rem] flex flex-col justify-center">
                                  <p className="font-semibold text-slate-800">{service.title}</p>
                                  {service.details && (
                                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{service.details}</p>
                                  )}
                                </div>
                                <span className="flex-shrink-0 rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700">
                                  {service.status}
                                </span>
                              </motion.li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Numéros de chambres */}
                  {deckRooms[selectedDeck] && (
                    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                        {t('shipmap.roomNumbers')} — {selectedDeckInfo?.name || ''}
                      </h3>
                      <div className="flex items-center justify-center gap-3 rounded-xl bg-slate-50 border border-slate-100 py-4">
                        <span className="text-2xl font-bold tabular-nums text-[#264FFF]">
                          {deckRooms[selectedDeck]}
                        </span>
                      </div>
                      <p className="mt-2 text-center text-xs text-slate-500">
                        Plage de numéros sur ce pont
                      </p>
                    </div>
                  )}
                </motion.section>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </motion.div>
  );
}
