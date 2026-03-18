/**
 * MainContent — version simplifiée.
 * - Une seule config (mainContentRoutes.js) : plus de gros if/else.
 * - Suspense + fallback unifiés selon la config (fallbackHeight).
 * - Même API que MainContent.jsx (props complètes passées par App).
 */
import React, { Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import PageTransition from './PageTransition';
import LoadingFallback from './LoadingFallback';
import { PAGE_CONFIG, getFallbackRoute } from './mainContentRoutes';

function MainContentSimplified(props) {
  const { page, t } = props;
  const route = PAGE_CONFIG[page] || getFallbackRoute(page);
  const { Component, getProps, useTransition, fallbackHeight } = route;
  const pageProps = getProps(props);

  const fallback = <LoadingFallback t={t} minHeight={fallbackHeight} />;
  const content = (
    <Suspense fallback={fallback}>
      <Component {...pageProps} />
    </Suspense>
  );

  const wrappedContent = useTransition ? (
    <PageTransition key={page} keyProp={page}>{content}</PageTransition>
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

export default React.memo(MainContentSimplified);
