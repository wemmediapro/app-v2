/**
 * Barre de navigation principale (fixe en bas) — extraite d’App.jsx (audit CTO).
 */
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Home, Radio, Clapperboard, Bell, Heart } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'home', Icon: Home, labelKey: 'common.home' },
  { key: 'radio', Icon: Radio, labelKey: 'common.radio' },
  { key: 'movies', Icon: Clapperboard, labelKey: 'common.movies' },
  { key: 'notifications', Icon: Bell, labelKey: 'notifications.title' },
  { key: 'favorites', Icon: Heart, labelKey: 'common.favorites' },
];

function BottomNav({ page, setPage, t, notificationsUnreadCount = 0, hidden = false }) {
  const items = useMemo(
    () => NAV_ITEMS.map(({ key, Icon, labelKey }) => ({ key, icon: <Icon size={26} />, label: t(labelKey) })),
    [t]
  );

  if (hidden) return null;

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-[768px] min-h-[44px] sm:min-h-[48px] mx-auto bg-gray-50 border-t border-gray-200 overflow-visible safe-area-bottom flex items-center"
      style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
    >
      <div className="flex items-center justify-center sm:justify-start w-full py-1.5 px-2 sm:px-2 gap-0 sm:gap-1 min-h-[44px] sm:min-h-[48px] overflow-visible">
        {items.map((item) => (
          <motion.button
            key={item.key}
            onClick={() => setPage(item.key)}
            whileTap={{ scale: 0.95 }}
            aria-label={item.label}
            className="relative flex flex-col items-center justify-center flex-1 min-w-0 min-h-[44px] sm:min-h-[48px] px-2 sm:px-4 py-1.5 transition-all touch-manipulation active:bg-gray-100 rounded-lg sm:rounded-none overflow-visible"
          >
            <div className={`relative transition-colors ${page === item.key ? 'text-blue-600' : 'text-gray-600'}`}>
              {item.icon}
            </div>
            {item.key === 'notifications' && notificationsUnreadCount > 0 && (
              <span
                className="absolute top-0 right-1 h-3 w-3 rounded-full border-2 border-gray-50 pointer-events-none bg-red-500"
                style={{ zIndex: 99, minWidth: 12, minHeight: 12 }}
                aria-label={`${notificationsUnreadCount} non lue(s)`}
              />
            )}
            {page === item.key && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                initial={false}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
          </motion.button>
        ))}
      </div>
    </nav>
  );
}

export default React.memo(BottomNav);
