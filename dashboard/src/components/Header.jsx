import { motion } from 'framer-motion';
import { Search, LogOut, Menu, User } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSelector from './LanguageSelector';

const Header = ({ user, onLogout, onMenuClick, showHamburger = false }) => {
  const { t } = useLanguage();
  const displayName = user?.firstName
    ? [user.firstName, user.lastName].filter(Boolean).join(' ')
    : t('navigation.admin') || 'Admin';

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-200 z-10 w-full"
    >
      <div className="mx-auto max-w-[1440px] w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-14 sm:h-16">
          {/* Gauche : hamburger + recherche */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            {showHamburger && typeof onMenuClick === 'function' && (
              <button
                type="button"
                onClick={onMenuClick}
                className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200 bg-white transition-colors shrink-0"
                aria-label={t('common.openMenu')}
                title="Menu"
              >
                <Menu size={22} strokeWidth={2} />
              </button>
            )}
            <div className="flex-1 min-w-0 max-w-xl">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder={t('common.search')}
                  aria-label={t('common.search')}
                  className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 bg-gray-50/80 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition-colors min-w-0"
                />
              </div>
            </div>
          </div>

          {/* Droite : langue, utilisateur, déconnexion */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <LanguageSelector />
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-600">
              <User size={16} className="shrink-0" />
              <span className="text-sm font-medium truncate max-w-[140px]" title={displayName}>
                {displayName}
              </span>
            </div>
            <motion.button
              onClick={onLogout}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors shrink-0"
              title={t('navigation.logout')}
              aria-label={t('navigation.logout')}
            >
              <LogOut size={18} />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.header>
  );
};

export default Header;



