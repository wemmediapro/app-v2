/**
 * MainContent — version maintenable.
 *
 * Responsabilités limitées :
 * - Lire la config des routes (mainContentRoutes.js).
 * - Rendre la page courante avec Suspense + transition selon la config.
 *
 * Pour ajouter une page :
 * 1. Lazy-import du composant dans mainContentRoutes.js.
 * 2. Créer getXxxProps(allProps) dans mainContentRoutes.js.
 * 3. Ajouter une entrée dans PAGE_CONFIG (Component, getProps, useTransition, fallbackHeight).
 *
 * Pour réduire le prop drilling à long terme : introduire des contextes par domaine
 * (ex. RadioContext, MoviesContext) et faire lire les pages dans ces contextes
 * au lieu de recevoir toutes les props depuis App.
 */
import React, { Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import PageTransition from './PageTransition';
import LoadingFallback from './LoadingFallback';
import { PAGE_CONFIG, getFallbackRoute } from './mainContentRoutes';

/**
 * @param {Object} props - Props passées par App (voir mainContentRoutes.js pour le détail par page).
 * @param {string} props.page - Identifiant de la page courante ('home' | 'radio' | 'movies' | …).
 * @param {function} props.t - Fonction de traduction (i18n).
 * @param {function} [props.setPage] - Change la page courante (navigation).
 */
function MainContentMaintainable(props) {
  const { page, t } = props;

  const route = PAGE_CONFIG[page] ?? getFallbackRoute(page);
  const { Component, getProps, useTransition, fallbackHeight } = route;
  const pageProps = getProps(props);

  const fallback = <LoadingFallback t={t} minHeight={fallbackHeight} />;
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

export default React.memo(MainContentMaintainable);
