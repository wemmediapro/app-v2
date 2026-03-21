/**
 * ErrorBoundary : isole les erreurs de rendu React, évite l’écran blanc sur toute l’app.
 * - `variant="root"` : enveloppe globale (main.jsx), textes autonomes + rechargement page.
 * - défaut : section (ex. contenu principal), peut utiliser `t` et `onGoHome`.
 */
import React from 'react';
import { capturePassengerException } from '../lib/sentryPassenger';

export default class ErrorBoundary extends React.Component {
  static defaultProps = {
    showRetryButton: true,
  };

  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo?.componentStack);
    capturePassengerException(error, {
      contexts: {
        react: {
          componentStack: errorInfo?.componentStack,
        },
      },
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { onGoHome, t, variant, showRetryButton } = this.props;
      const isRoot = variant === 'root';
      const translate = typeof t === 'function' ? t : (k) => k;

      const title = isRoot ? 'Une erreur est survenue' : translate('common.errorLoading') || 'Erreur de chargement';
      const hint = isRoot
        ? 'L’application a rencontré un problème. Vous pouvez réessayer ou recharger la page.'
        : this.state.error?.message || 'Une erreur est survenue.';

      const showRetry = showRetryButton !== false;

      return (
        <div
          className={
            isRoot
              ? 'flex flex-col items-center justify-center min-h-screen w-full px-4 py-10 text-center bg-gray-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100'
              : 'flex flex-col items-center justify-center min-h-[40vh] px-4 py-8 text-center bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-700'
          }
          role="alert"
        >
          <h2 className={`font-semibold ${isRoot ? 'text-xl' : 'text-lg'}`}>{title}</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md">{hint}</p>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            {showRetry && (
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-2 rounded-lg bg-[#264FFF] text-white text-sm font-medium hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#264FFF]"
              >
                {translate('common.retry') || 'Réessayer'}
              </button>
            )}
            {isRoot && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400"
              >
                Recharger la page
              </button>
            )}
            {!isRoot && typeof onGoHome === 'function' && (
              <button
                type="button"
                onClick={() => {
                  this.handleRetry();
                  onGoHome();
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {translate('common.home') || 'Accueil'}
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
