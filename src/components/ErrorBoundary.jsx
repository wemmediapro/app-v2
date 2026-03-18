/**
 * ErrorBoundary pour une section (ex. contenu principal).
 * Affiche un fallback avec bouton "Réessayer" et option "Retour accueil".
 */
import React from 'react';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const { onRetry, onGoHome, t } = this.props;
      const translate = t || ((k) => k);
      return (
        <div
          className="flex flex-col items-center justify-center min-h-[40vh] px-4 py-8 text-center bg-slate-50 rounded-xl border border-slate-200"
          role="alert"
        >
          <h2 className="text-lg font-semibold text-slate-800">
            {translate('common.errorLoading') || 'Erreur de chargement'}
          </h2>
          <p className="mt-2 text-sm text-slate-600 max-w-md">
            {this.state.error?.message || 'Une erreur est survenue.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            {onRetry && (
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 rounded-lg bg-[#264FFF] text-white text-sm font-medium hover:opacity-90"
              >
                {translate('common.retry') || 'Réessayer'}
              </button>
            )}
            {onGoHome && (
              <button
                type="button"
                onClick={() => { this.setState({ hasError: false, error: null }); onGoHome(); }}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-100"
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
