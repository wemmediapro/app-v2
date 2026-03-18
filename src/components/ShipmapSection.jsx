/**
 * Bloc Shipmap : page plan du bateau + modal « Ajouter au plan » (audit CTO — découpage App.jsx).
 */
import React, { Suspense, lazy } from 'react';
import LoadingFallback from './LoadingFallback';

const ShipmapPage = lazy(() => import('./ShipmapPage'));

export default function ShipmapSection({
  t,
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
  showShipmapAddPlanModal,
  setShowShipmapAddPlanModal,
}) {
  return (
    <>
      <Suspense fallback={<LoadingFallback t={t} />}>
        <ShipmapPage
          t={t}
          shipmapShip={shipmapShip}
          shipmapLoading={shipmapLoading}
          refetchShipmap={refetchShipmap}
          shipDecks={shipDecks}
          shipDecksFiltered={shipDecksFiltered}
          selectedDeck={selectedDeck}
          setSelectedDeck={setSelectedDeck}
          shipmapDeckTypeFilter={shipmapDeckTypeFilter}
          setShipmapDeckTypeFilter={setShipmapDeckTypeFilter}
          shipSearchQuery={shipSearchQuery}
          setShipSearchQuery={setShipSearchQuery}
          deckServices={deckServices}
          selectedDeckInfo={selectedDeckInfo}
          filteredDeckServices={filteredDeckServices}
          deckRooms={deckRooms}
        />
      </Suspense>
      {showShipmapAddPlanModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shipmap-add-plan-title"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h2 id="shipmap-add-plan-title" className="text-lg font-semibold text-gray-900 mb-3">
              {t('shipmap.addPlanModalTitle')}
            </h2>
            <p className="text-gray-600 text-sm mb-5">{t('shipmap.addPlanModalMessage')}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowShipmapAddPlanModal(false)}
                className="px-4 py-2 bg-[#264FFF] text-white rounded-xl hover:bg-[#1e3fe6] transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
