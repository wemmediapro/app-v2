/**
 * MainContent — version plus performante.
 * - Réutilise la config (mainContentRoutes.js).
 * - Fallback Suspense mémoïsé par (minHeight, t) pour éviter de recréer l’élément à chaque render.
 * - Un seul enfant rendu par page (key={page}) pour limiter le travail de réconciliation.
 * Pour aller plus loin : dans App, passer des callbacks mémoïsés (useCallback) et des objets
 * mémoïsés (useMemo) pour les props des pages, afin que React.memo sur les pages enfants soit efficace.
 */
import React, { Suspense, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import PageTransition from './PageTransition';
import LoadingFallback from './LoadingFallback';
import { PAGE_CONFIG, getFallbackRoute } from './mainContentRoutes';

function MainContentPerformant(props) {
  const { page, t } = props;
  const route = PAGE_CONFIG[page] || getFallbackRoute(page);
  const { Component, getProps, useTransition, fallbackHeight } = route;

  const pageProps = getProps(props);

  const fallback = useMemo(
    () => <LoadingFallback t={t} minHeight={fallbackHeight} />,
    [t, fallbackHeight],
  );

  const content = (
    <Suspense fallback={fallback}>
      <Component {...pageProps} />
    </Suspense>
  );

  const wrappedContent = useTransition ? (
    <PageTransition key={page} keyProp={page}>
      {content}
    </PageTransition>
  ) : (
    <React.Fragment key={page}>{content}</React.Fragment>
  );

  if (page === 'home') {
    return content;
  }

  return (
    <AnimatePresence mode="wait">
      {wrappedContent}
    </AnimatePresence>
  );
}

export default React.memo(MainContentPerformant);
