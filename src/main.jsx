/**
 * Bootstrap React (Vite) : providers globaux, PWA / service worker, Framer Motion lazy.
 *
 * Arborescence : `ErrorBoundary` (root) → `LanguageProvider` → `ThemeProvider` → `BrowserRouter` → `LazyMotion` → `Suspense` → `App` (import dynamique `PassengerApp`).
 * Sentry passager : `initPassengerSentry()` si `VITE_SENTRY_DSN` est défini.
 * Les Web Vitals sont initialisés une fois au chargement (`initWebVitalsReporting`).
 */
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LazyMotion } from 'framer-motion';

const App = lazy(() => import('./App.jsx'));
import './styles/fonts.css';
import './styles/index.css';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { initWebVitalsReporting } from './lib/webVitals';
import { initPassengerSentry } from './lib/sentryPassenger';
import ErrorBoundary from './components/ErrorBoundary.jsx';

initWebVitalsReporting();
initPassengerSentry();

const loadMotionFeatures = () => import('./lib/framerLazyFeatures.js').then((m) => m.domAnimation);

// ——— Service Worker (PWA) ———
// En développement : désinscrire tout SW pour éviter le cache et voir les changements à chaud
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

// En production : enregistrement explicite du Service Worker (généré par VitePWA / Workbox)
if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onRegistered(registration) {
          if (registration) {
            console.log('✅ Service Worker enregistré (scope:', registration.scope, ')');
          }
        },
        onRegisterError(e) {
          console.warn('⚠️ Échec enregistrement Service Worker:', e);
        },
      });
    })
    .catch(() => {
      // Fallback si le module virtuel n'existe pas (build sans plugin PWA)
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(
        (reg) => console.log('✅ Service Worker enregistré (fallback)', reg.scope),
        (err) => console.warn('⚠️ Service Worker non enregistré', err)
      );
    });
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  console.error('Élément #root introuvable.');
  document.body.innerHTML = '<p style="padding:2rem;font-family:sans-serif;">Erreur: élément #root introuvable.</p>';
} else {
  try {
    const root = ReactDOM.createRoot(rootEl);
    root.render(
      <React.StrictMode>
        <ErrorBoundary variant="root">
          <LanguageProvider>
            <ThemeProvider>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <LazyMotion features={loadMotionFeatures}>
                  <Suspense
                    fallback={
                      <div
                        role="status"
                        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white font-medium"
                      >
                        Chargement…
                      </div>
                    }
                  >
                    <App />
                  </Suspense>
                </LazyMotion>
              </BrowserRouter>
            </ThemeProvider>
          </LanguageProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
  } catch (err) {
    console.error('Erreur au démarrage:', err);
    rootEl.innerHTML = `
      <div style="padding:2rem;font-family:sans-serif;max-width:100%;margin:0 auto;color:#1f2937;">
        <h1 style="color:#b91c1c;">Erreur de chargement</h1>
        <p style="margin:1rem 0;">${err?.message || String(err)}</p>
        <p style="font-size:0.875rem;color:#6b7280;">Ouvre la console (F12) pour plus de détails.</p>
      </div>
    `;
  }
}
