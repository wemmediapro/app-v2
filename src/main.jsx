import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles/fonts.css'
import './styles/index.css'
import { LanguageProvider } from './contexts/LanguageContext'

// Sentry (initialisation conditionnelle côté client — Vite expose VITE_ env vars)
(async function initSentry() {
  try {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) return;
    const Sentry = await import('@sentry/react');
    const { BrowserTracing } = await import('@sentry/tracing');

    Sentry.init({
      dsn,
      integrations: [new BrowserTracing()],
      tracesSampleRate: parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.02'),
      environment: import.meta.env.MODE || 'development'
    });
  } catch (err) {
    // Ne pas empêcher l'app de démarrer si Sentry n'est pas installé
    // eslint-disable-next-line no-console
    console.warn('Sentry init failed (optional).', err);
  }
})();

// ——— Service Worker (PWA) ———
// En développement : désinscrire tout SW pour éviter le cache et voir les changements à chaud
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister())
  })
}

// En production : enregistrement explicite du Service Worker (généré par VitePWA / Workbox)
if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onRegistered(registration) {
        if (registration) {
          console.log('✅ Service Worker enregistré (scope:', registration.scope, ')')
        }
      },
      onRegisterError(e) {
        console.warn('⚠️ Échec enregistrement Service Worker:', e)
      },
    })
  }).catch(() => {
    // Fallback si le module virtuel n'existe pas (build sans plugin PWA)
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(
      (reg) => console.log('✅ Service Worker enregistré (fallback)', reg.scope),
      (err) => console.warn('⚠️ Service Worker non enregistré', err)
    )
  })
}

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('Erreur React:', error, info.componentStack)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '100%', margin: '0 auto' }}>
          <h1 style={{ color: '#c00' }}>Erreur de chargement</h1>
          <p>{this.state.error?.message || 'Une erreur est survenue.'}</p>
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
if (!rootEl) {
  console.error('Élément #root introuvable.')
  document.body.innerHTML = '<p style="padding:2rem;font-family:sans-serif;">Erreur: élément #root introuvable.</p>'
} else {
  try {
    const root = ReactDOM.createRoot(rootEl)
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <LanguageProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <App />
            </BrowserRouter>
          </LanguageProvider>
        </ErrorBoundary>
      </React.StrictMode>
    )
    const loading = document.getElementById('loading')
    if (loading) loading.style.display = 'none'
  } catch (err) {
    console.error('Erreur au démarrage:', err)
    rootEl.innerHTML = `
      <div style="padding:2rem;font-family:sans-serif;max-width:100%;margin:0 auto;color:#1f2937;">
        <h1 style="color:#b91c1c;">Erreur de chargement</h1>
        <p style="margin:1rem 0;">${err?.message || String(err)}</p>
        <p style="font-size:0.875rem;color:#6b7280;">Ouvre la console (F12) pour plus de détails.</p>
      </div>
    `
  }
}
