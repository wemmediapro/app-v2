/**
 * Bandeau « hors ligne » affiché quand l’utilisateur n’a pas de connexion (audit CTO — découpage App.jsx).
 */
import React from 'react';
import { Wifi } from 'lucide-react';

export default function OfflineBanner({ isOnline, t }) {
  if (isOnline) return null;
  return (
    <div
      className="fixed left-0 right-0 z-[99] max-w-[768px] mx-auto flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium shadow-md safe-area-top"
      style={{ top: 'calc(60px + env(safe-area-inset-top, 0px))' }}
      role="status"
      aria-live="polite"
    >
      <Wifi size={18} className="flex-shrink-0 opacity-90" />
      <span>{t('common.offlineBanner')}</span>
    </div>
  );
}
