/**
 * Zone centrale : affiche **une** page à la fois selon `page` (state passager).
 *
 * Implémentation : `PAGE_CONFIG` dans `mainContentRoutes.js` (lazy + `getProps` par page).
 * Un seul arbre d’enfant par navigation (`key={page}`) pour limiter la réconciliation ;
 * fallback Suspense mémoïsé par `(minHeight, t)`.
 *
 * Données :
 * - **Production** : `PassengerMainContentContext` (rempli par `AppPassengerLayout`).
 * - **Tests** : props directes ; si le contexte est absent et `props` vide, `{}`.
 *
 * `AnimatePresence` + `PageTransition` gèrent les entrées/sorties (pages avec `useTransition: true`).
 */
import React, { Suspense, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { usePassengerMainContentOptional } from '../contexts/PassengerMainContentContext';
import PageTransition from './PageTransition';
import LoadingFallback from './LoadingFallback';
import { PAGE_CONFIG, getFallbackRoute } from './mainContentRoutes';

function MainContent(props) {
  const fromContext = usePassengerMainContentOptional();
  const merged = useMemo(() => {
    if (fromContext == null) {
      return props ?? {};
    }
    if (props == null || (typeof props === 'object' && Object.keys(props).length === 0)) {
      return fromContext;
    }
    return { ...fromContext, ...props };
  }, [fromContext, props]);
  const { page, t } = merged;
  const route = PAGE_CONFIG[page] || getFallbackRoute(page);
  const { Component, getProps, useTransition, fallbackHeight } = route;

  const pageProps = getProps(merged);

  const fallback = useMemo(() => <LoadingFallback t={t} minHeight={fallbackHeight} />, [t, fallbackHeight]);

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

  return <AnimatePresence mode="wait">{wrappedContent}</AnimatePresence>;
}

export default React.memo(MainContent);
