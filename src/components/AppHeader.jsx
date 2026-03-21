/**
 * Header fixe (logo GNV, bouton retour, sélecteur de langue) — extrait d’App.jsx (audit CTO).
 */
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import LanguageSelector from './LanguageSelector';
import ThemeToggle from './ThemeToggle';

function AppHeader({ page, setPage, t }) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between gap-2 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-3 text-white shadow-lg rounded-b-2xl min-h-[60px] sm:min-h-[56px] max-w-[768px] mx-auto bg-[#264FFF] safe-area-top"
      style={{
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 min-w-0">
        {page !== 'home' && (
          <button
            onClick={() => setPage('home')}
            className="flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-full transition-all hover:opacity-90 active:scale-95 touch-manipulation flex-shrink-0"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.25)' }}
            aria-label={t('common.back')}
          >
            <ArrowLeft size={22} className="text-white sm:w-6 sm:h-6" />
          </button>
        )}
        <button
          onClick={() => setPage('home')}
          className="outline-none focus:ring-0 flex items-center min-w-0"
          aria-label={t('common.home')}
        >
          <img src="/logo-gnv.png" alt="GNV" className="h-7 sm:h-8 w-auto object-contain" />
        </button>
      </div>
      <div className="flex items-center justify-end gap-1.5 sm:gap-3 flex-shrink-0">
        <ThemeToggle variant="light" />
        <LanguageSelector variant="light" />
      </div>
    </header>
  );
}

export default React.memo(AppHeader);
