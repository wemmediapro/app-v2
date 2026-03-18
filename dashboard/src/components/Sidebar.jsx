import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Ship, 
  Users, 
  Utensils, 
  Bell,
  BarChart3,
  Settings,
  Radio,
  Clapperboard,
  BookOpen,
  Baby,
  ShoppingBag,
  Image,
  Tv,
  FolderOpen,
  Map,
  Megaphone,
  Wifi,
  X,
  LineChart,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getAccessByRole } from '../pages/Settings';
import { apiService } from '../services/apiService';

const Sidebar = ({ user, isOpen = false, onClose, isMobileView = true }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeItem, setActiveItem] = useState('dashboard');
  const [unreadCount, setUnreadCount] = useState(0);
  const userRole = user?.role === 'admin' || user?.role === 'crew' || user?.role === 'passenger' ? user.role : 'admin';
  const accessByRole = getAccessByRole();
  const roleAccess = accessByRole[userRole] || accessByRole.admin;
  const access = user?.allowedModules && typeof user.allowedModules === 'object' && Object.keys(user.allowedModules).length > 0
    ? user.allowedModules
    : roleAccess;

  useEffect(() => {
    if (typeof onClose === 'function') onClose();
  }, [location.pathname]);

  useEffect(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const path = segments[0] || 'dashboard';
    const subPath = segments[1];
    if (path === 'settings' && subPath === 'connection') {
      setActiveItem('settings-connection');
    } else {
      setActiveItem(path);
    }
  }, [location]);

  useEffect(() => {
    let cancelled = false;
    apiService.getConversationsUnreadCount()
      .then((res) => {
        if (!cancelled && res?.data?.count != null) setUnreadCount(res.data.count);
      })
      .catch(() => { if (!cancelled) setUnreadCount(0); });
    return () => { cancelled = true; };
  }, [location.pathname]);

  const hasUnreadMessages = unreadCount > 0;

  const menuGroups = [
    {
      labelKey: 'navigation.overview',
      items: [
        { id: 'dashboard', labelKey: 'navigation.dashboard', icon: BarChart3, path: '/dashboard' },
        { id: 'statistics', labelKey: 'navigation.statistics', icon: LineChart, path: '/statistics' },
        { id: 'messages', labelKey: 'navigation.notifications', icon: Bell, path: '/messages' },
        { id: 'connexions', labelKey: 'navigation.connexions', icon: Wifi, path: '/connexions' },
      ],
    },
    {
      labelKey: 'navigation.media',
      items: [
        { id: 'radio', labelKey: 'navigation.radio', icon: Radio, path: '/radio' },
        { id: 'movies', labelKey: 'navigation.movies', icon: Clapperboard, path: '/movies' },
        { id: 'webtv', labelKey: 'navigation.webtv', icon: Tv, path: '/webtv' },
        { id: 'bibliotheque', labelKey: 'navigation.mediaLibrary', icon: FolderOpen, path: '/bibliotheque' },
        { id: 'magazine', labelKey: 'navigation.magazine', icon: BookOpen, path: '/magazine' },
      ],
    },
    {
      labelKey: 'navigation.services',
      items: [
        { id: 'restaurants', labelKey: 'navigation.restaurants', icon: Utensils, path: '/restaurants' },
        { id: 'shop', labelKey: 'navigation.shop', icon: ShoppingBag, path: '/shop' },
        { id: 'shipmap', labelKey: 'navigation.shipmap', icon: Map, path: '/shipmap' },
        { id: 'enfant', labelKey: 'navigation.enfant', icon: Baby, path: '/enfant' },
        { id: 'banners', labelKey: 'navigation.banners', icon: Image, path: '/banners' },
        { id: 'ads', labelKey: 'navigation.ads', icon: Megaphone, path: '/ads' },
      ],
    },
    {
      labelKey: 'navigation.community',
      items: [
        { id: 'users', labelKey: 'navigation.users', icon: Users, path: '/users' },
        { id: 'settings', labelKey: 'navigation.settings', icon: Settings, path: '/settings' },
        { id: 'settings-connection', labelKey: 'settings.goToConnections', icon: Wifi, path: '/settings/connection' },
      ],
    },
  ];

  return (
    <>
      {/* Backdrop (uniquement en vue mobile/tablette quand le menu est ouvert) */}
      <AnimatePresence>
        {isMobileView && isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => typeof onClose === 'function' && onClose()}
            className="fixed inset-0 z-40 bg-black/50"
            aria-hidden
          />
        )}
      </AnimatePresence>

      <div
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white shadow-lg border-r border-gray-200 transition-transform duration-200 ease-out w-[min(100%,16rem)] sm:w-64 ${
          isMobileView ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'
        }`}
      >
        {/* Logo + fermer (mobile) */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-5 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600">
              <Ship size={18} className="text-white sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-base lg:text-lg font-bold text-gray-900 truncate">GNV Dashboard</h1>
              <p className="text-[10px] sm:text-xs text-gray-500 truncate">Administration</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => typeof onClose === 'function' && onClose()}
            className={isMobileView ? 'p-2.5 -m-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg touch-manipulation' : 'hidden'}
            aria-label={t('common.closeMenu')}
          >
            <X size={22} />
          </button>
        </div>

      {/* Navigation groupée avec défilement */}
      <nav className="mt-2 sm:mt-4 px-2 sm:px-3 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-6 sm:pb-8 sidebar-nav-scroll">
        {menuGroups.map((group) => {
          const visibleItems = group.items.filter((item) => access[item.id]);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.labelKey} className="mb-4 sm:mb-6">
              <p className="px-2 sm:px-3 mb-1.5 sm:mb-2 text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
                {t(group.labelKey)}
              </p>
              <div className="space-y-0.5 sm:space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const showUnreadDot = item.id === 'messages' && hasUnreadMessages;
                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => {
                        setActiveItem(item.id);
                        navigate(item.path);
                      }}
                      className={`w-full flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-3 sm:py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[48px] sm:min-h-[44px] touch-manipulation ${
                        activeItem === item.id
                          ? 'bg-blue-50 text-blue-700 border-l-2 border-r-0 sm:border-l-0 sm:border-r-2 border-blue-600'
                          : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                      }`}
                      aria-label={t(item.labelKey)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <span className="relative flex-shrink-0">
                        <Icon size={20} className="sm:w-[18px] sm:h-[18px]" />
                        {showUnreadDot && (
                          <span
                            className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white"
                            aria-hidden
                          />
                        )}
                      </span>
                      <span className="truncate text-left">{t(item.labelKey)}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

        {/* Pied de menu : Powered by Mediapro */}
        <div className="shrink-0 px-3 sm:px-4 py-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">Powered by Mediapro</p>
        </div>
    </div>
    </>
  );
};

export default Sidebar;


