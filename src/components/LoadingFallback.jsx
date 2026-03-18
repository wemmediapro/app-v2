/**
 * Fallback de chargement pour Suspense — réutilisable dans toute l'app (audit CTO).
 */
import React from 'react';

const MIN_HEIGHT = {
  screen: 'min-h-screen',
  short: 'min-h-[200px]',
  medium: 'min-h-[300px]',
};

export default function LoadingFallback({ t, minHeight = 'screen', className = '' }) {
  const minHeightClass = typeof minHeight === 'string' ? MIN_HEIGHT[minHeight] || minHeight : 'min-h-screen';
  return (
    <div
      className={`flex items-center justify-center bg-slate-50 ${minHeightClass} ${className}`.trim()}
      role="status"
      aria-label={t ? t('common.loading') : 'Chargement…'}
    >
      <span className="text-slate-500">{t ? t('common.loading') : 'Chargement…'}</span>
    </div>
  );
}
