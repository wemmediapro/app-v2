/**
 * Coque UI passager après acceptation des conditions.
 *
 * Flux de rendu :
 * 1. `ConditionsGate` tant que les CGU / politique ne sont pas acceptées (persistées en localStorage).
 * 2. `AppHeader` + `OfflineBanner` + toasts file offline (`offlineQueue` / `offlineSentNotice`).
 * 3. `PassengerMainContentProvider` : injecte `mainContentProps` pour que `MainContent` lise le contexte
 *    (évite de passer des dizaines de props depuis ce composant).
 * 4. `BannersCarousel`, `MainContent` (router de pages lazy), `BottomNav`.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PassengerMainContentProvider } from '../contexts/PassengerMainContentContext';
import ConditionsGate from './ConditionsGate';
import AppHeader from './AppHeader';
import OfflineBanner from './OfflineBanner';
import ErrorBoundary from './ErrorBoundary';
import BannersCarousel from './BannersCarousel';
import BottomNav from './BottomNav';
import MainContent from './MainContent';

/** @param {Record<string, unknown>} props */
export function AppPassengerLayout(props) {
  const {
    conditionsAccepted,
    setConditionsAccepted,
    navigate,
    setPage,
    t,
    page,
    isOnline,
    offlineQueue,
    offlineSentNotice,
    syncFeedback,
    banners,
    notificationsUnreadCount,
    mainContentProps,
  } = props;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#264FFF] to-[#264FFF] dark:from-slate-950 dark:to-slate-900">
      <AnimatePresence mode="wait">
        {!conditionsAccepted ? (
          <ConditionsGate
            t={t}
            onAccept={() => {
              setConditionsAccepted(true);
              setPage('home');
              navigate('/', { replace: true });
            }}
          />
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            className="min-h-screen w-full max-w-full flex flex-col relative bg-gray-50 dark:bg-slate-900 px-2 sm:px-3 overflow-x-hidden pb-[max(3rem,calc(3rem+env(safe-area-inset-bottom,0px)))] sm:pb-12"
          >
            <AppHeader page={page} setPage={setPage} t={t} />

            <OfflineBanner isOnline={isOnline} t={t} />

            {offlineQueue.pendingCount > 0 && (
              <div
                className="fixed left-0 right-0 z-[98] max-w-[768px] mx-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium shadow-md safe-area-top"
                style={{
                  top: !isOnline
                    ? 'calc(60px + env(safe-area-inset-top, 0px) + 2.5rem)'
                    : 'calc(60px + env(safe-area-inset-top, 0px))',
                }}
                role="status"
                aria-live="polite"
              >
                <span>{t('common.offlineQueuePending', { count: offlineQueue.pendingCount })}</span>
              </div>
            )}

            {offlineSentNotice && (
              <div
                className="fixed left-2 right-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-[100] max-w-md mx-auto rounded-lg px-4 py-3 bg-emerald-600 text-white text-sm font-medium shadow-lg text-center"
                role="status"
                aria-live="polite"
              >
                {t('common.offlineQueueSent', { count: offlineSentNotice.sent })}
              </div>
            )}

            {syncFeedback?.state === 'syncing' && (
              <div
                className="fixed left-2 right-2 bottom-[calc(7.5rem+env(safe-area-inset-bottom,0px))] z-[99] max-w-md mx-auto rounded-lg px-4 py-3 bg-sky-600 text-white text-sm font-medium shadow-lg text-center"
                role="status"
                aria-live="polite"
              >
                {t('common.syncMessagesPending')}
              </div>
            )}
            {syncFeedback?.state === 'success' && syncFeedback.processed > 0 && (
              <div
                className="fixed left-2 right-2 bottom-[calc(7.5rem+env(safe-area-inset-bottom,0px))] z-[99] max-w-md mx-auto rounded-lg px-4 py-3 bg-teal-600 text-white text-sm font-medium shadow-lg text-center"
                role="status"
                aria-live="polite"
              >
                {t('common.syncMessagesSuccess', { count: syncFeedback.processed })}
              </div>
            )}
            {syncFeedback?.state === 'error' && (
              <div
                className="fixed left-2 right-2 bottom-[calc(7.5rem+env(safe-area-inset-bottom,0px))] z-[99] max-w-md mx-auto rounded-lg px-4 py-3 bg-rose-600 text-white text-sm font-medium shadow-lg text-center"
                role="status"
                aria-live="polite"
              >
                {t('common.syncMessagesError')}
              </div>
            )}

            <main
              className={`flex-1 p-2 sm:p-3 md:p-4 overflow-y-auto overflow-x-hidden ${!isOnline || offlineQueue.pendingCount > 0 ? 'pt-[calc(7rem+env(safe-area-inset-top,0px))] sm:pt-[7.5rem] md:pt-[8rem]' : 'pt-[calc(5rem+env(safe-area-inset-top,0px))] sm:pt-[80px] md:pt-[84px]'}`}
            >
              <BannersCarousel
                banners={banners.homeBanners}
                bannerIndex={banners.bannerIndex}
                setBannerIndex={banners.setBannerIndex}
                getBannerImageUrl={banners.getBannerImageUrl}
                bannerViewWidth={banners.bannerViewWidth}
                backendOrigin={banners.backendOrigin}
                t={t}
                onBannerClick={banners.handleBannerClick}
              />

              <ErrorBoundary t={t} showRetryButton onGoHome={() => setPage('home')}>
                <PassengerMainContentProvider value={mainContentProps}>
                  <MainContent />
                </PassengerMainContentProvider>
              </ErrorBoundary>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav
        page={page}
        setPage={setPage}
        t={t}
        notificationsUnreadCount={notificationsUnreadCount}
        hidden={!conditionsAccepted}
      />
    </div>
  );
}
