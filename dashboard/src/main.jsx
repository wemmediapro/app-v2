import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Sentry (initialisation conditionnelle pour le dashboard — API v8)
(async function initSentry() {
  try {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) return;
    const Sentry = await import('@sentry/react');
    const { browserTracingIntegration } = Sentry;

    Sentry.init({
      dsn,
      integrations: [browserTracingIntegration()],
      tracesSampleRate: parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.02'),
      environment: import.meta.env.MODE || 'development'
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Sentry init failed (optional).', err);
  }
})();

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('Erreur dashboard:', error, info.componentStack)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '600px', margin: '2rem auto' }}>
          <h1 style={{ color: '#b91c1c' }}>Erreur de chargement</h1>
          <p style={{ margin: '1rem 0', color: '#374151' }}>{this.state.error?.message || 'Une erreur est survenue.'}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Réessayer
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Élément #root introuvable dans le DOM')
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)