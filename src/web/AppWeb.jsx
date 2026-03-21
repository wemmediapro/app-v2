import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ship,
  Radio,
  Clapperboard,
  BookOpen,
  Tv,
  Utensils,
  Grid3X3,
  ShoppingBag,
  Map,
  MessageSquare,
  Menu,
  X,
  Search,
  Settings,
  HelpCircle,
  Sun,
  WifiOff,
  Play,
  Bell,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';
import { apiService } from '../services/apiService';

const categories = [
  { key: 'webtv', icon: Tv, labelKey: 'common.webtv' },
  { key: 'movies', icon: Clapperboard, labelKey: 'common.movies' },
  { key: 'radio', icon: Radio, labelKey: 'common.radio' },
  { key: 'magazine', icon: BookOpen, labelKey: 'common.magazine' },
  { key: 'restaurant', icon: Utensils, labelKey: 'common.restaurants' },
  { key: 'shop', icon: ShoppingBag, labelKey: 'common.shop' },
  { key: 'shipmap', icon: Map, labelKey: 'common.shipmap' },
  { key: 'enfant', icon: Grid3X3, labelKey: 'common.enfant' },
  { key: 'chat', icon: MessageSquare, labelKey: 'common.chat' },
];

// Contenu type "chaînes" par catégorie (pour la liste + panneau détail)
const channelByCategory = {
  webtv: [
    { id: '1', name: 'GNV Live', views: '12K', live: true, hd: true, desc: 'Retransmission en direct des événements à bord.' },
    { id: '2', name: 'Info Traversée', views: '8K', live: true, hd: false, desc: 'Informations voyage et escales en temps réel.' },
    { id: '3', name: 'Divertissement', views: '25K', live: false, hd: true, desc: 'Films et séries en continu.' },
  ],
  movies: [
    { id: '1', name: 'Films à la demande', views: '45K', hd: true, desc: 'Catalogue de films récents et classiques.' },
    { id: '2', name: 'Séries', views: '32K', hd: true, desc: 'Séries et épisodes en streaming.' },
  ],
  radio: [
    { id: '1', name: 'GNV Radio', views: '850K', live: true, desc: 'Musique et programmes sélectionnés pour la traversée.' },
    { id: '2', name: 'Ambiance Lounge', views: '120K', live: true, desc: 'Ambiance détente et world music.' },
  ],
  magazine: [
    { id: '1', name: 'Magazine GNV', views: '18K', desc: 'Articles, actualités et bons plans voyage.' },
  ],
  restaurant: [
    { id: '1', name: 'Carte des restaurants', views: '22K', desc: 'Menus, horaires et réservations.' },
  ],
  shop: [
    { id: '1', name: 'Boutique à bord', views: '9K', desc: 'Souvenirs et shopping duty-free.' },
  ],
  shipmap: [
    { id: '1', name: 'Plan du bateau', views: '55K', desc: 'Ponts, équipements et services.' },
  ],
  enfant: [
    { id: '1', name: 'Espace Enfants', views: '14K', desc: 'Activités et divertissements pour les plus jeunes.' },
  ],
  chat: [
    { id: '1', name: 'Messagerie', views: '5K', desc: 'Échangez avec l’équipage et les autres passagers.' },
  ],
};

const bottomNavItems = [
  { key: 'webtv', icon: Tv, labelKey: 'common.webtv' },
  { key: 'restaurant', icon: Utensils, labelKey: 'common.restaurants' },
  { key: 'shipmap', icon: Map, labelKey: 'common.shipmap' },
  { key: 'more', icon: Grid3X3, labelKey: 'More' },
];

const defaultChannels = channelByCategory.webtv;

export default function AppWeb() {
  const { t, language } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeCategory, setActiveCategory] = useState('webtv');
  const [selectedChannel, setSelectedChannel] = useState(defaultChannels[0]);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [notificationsList, setNotificationsList] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState(0);
  const notificationsPanelRef = useRef(null);
  const NOTIFICATIONS_LAST_OPEN_KEY = 'gnv_notifications_last_open';

  useEffect(() => {
    if (!showNotificationsPanel) return;
    setNotificationsLoading(true);
    setNotificationsUnreadCount(0);
    try {
      localStorage.setItem(NOTIFICATIONS_LAST_OPEN_KEY, String(Date.now()));
    } catch (_) {}
    const lang = language === 'fr' ? 'fr' : language === 'en' ? 'en' : 'fr';
    apiService.getNotifications(`limit=20&lang=${lang}&_=${Date.now()}`)
      .then((r) => {
        const raw = r?.data;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw?.notifications)
              ? raw.notifications
              : [];
        setNotificationsList(list);
      })
      .catch(() => setNotificationsList([]))
      .finally(() => setNotificationsLoading(false));
  }, [showNotificationsPanel, language]);

  // Point rouge : afficher dès qu'il y a au moins une notification (ou plus récentes que la dernière ouverture)
  useEffect(() => {
    if (showNotificationsPanel) return;
    const lang = language === 'fr' ? 'fr' : language === 'en' ? 'en' : 'fr';
    const fetchUnread = () => {
      apiService.getNotifications(`limit=50&lang=${lang}&_=${Date.now()}`)
        .then((r) => {
          const raw = r?.data;
          const list = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.data)
              ? raw.data
              : Array.isArray(raw?.notifications)
                ? raw.notifications
                : [];
          let lastOpen = 0;
          try {
            lastOpen = parseInt(localStorage.getItem(NOTIFICATIONS_LAST_OPEN_KEY) || '0', 10);
          } catch (_) {}
          let count;
          if (list.length === 0) {
            count = 0;
          } else if (lastOpen <= 0) {
            count = list.length;
          } else {
            count = list.filter((n) => {
              const t = n.createdAt != null ? new Date(n.createdAt).getTime() : 0;
              return t > lastOpen;
            }).length;
          }
          setNotificationsUnreadCount(count);
        })
        .catch(() => setNotificationsUnreadCount(0));
    };
    fetchUnread();
    const t1 = setTimeout(fetchUnread, 800);
    const interval = setInterval(fetchUnread, 5 * 1000); // 5 s pour que le point rouge apparaisse vite après envoi depuis le dashboard
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchUnread();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearTimeout(t1);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [showNotificationsPanel, language]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (notificationsPanelRef.current && !notificationsPanelRef.current.contains(e.target)) {
        setShowNotificationsPanel(false);
      }
    }
    if (showNotificationsPanel) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showNotificationsPanel]);

  React.useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const channels = channelByCategory[activeCategory] || defaultChannels;

  React.useEffect(() => {
    const list = channelByCategory[activeCategory] || defaultChannels;
    setSelectedChannel(list[0]);
  }, [activeCategory]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      {/* ——— Top bar (style divertissement à bord) ——— */}
      <header className="sticky top-0 z-50 w-full max-w-[768px] mx-auto flex items-center justify-between h-14 md:h-16 px-4 md:px-6 bg-slate-900/95 border-b border-slate-700/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="hidden lg:flex p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label={t('common.menu')}
          >
            <Menu size={22} />
          </button>
          <a href="/web.html" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-2xl">🚢</span>
            <span className="font-bold text-white text-lg hidden sm:inline">GNV OnBoard</span>
          </a>
          <span className="hidden md:inline text-xs text-slate-400 border-l border-slate-600 pl-3 ml-1">
            NICE ↔ BASTIA
          </span>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          {offline && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/20 text-amber-400 text-xs">
              <WifiOff size={14} />
              Offline
            </span>
          )}
          <div className="relative" ref={notificationsPanelRef}>
            <button
              type="button"
              onClick={() => setShowNotificationsPanel((open) => !open)}
              className={`relative p-2 rounded-lg transition-colors ${showNotificationsPanel ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              aria-label={t('common.notifications')}
              aria-expanded={showNotificationsPanel}
            >
              <Bell size={20} />
              {notificationsUnreadCount > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full ring-2 ring-slate-900" aria-hidden="true" />
              )}
            </button>
            <AnimatePresence>
              {showNotificationsPanel && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] overflow-hidden rounded-xl bg-slate-800 border border-slate-700 shadow-xl z-[200] flex flex-col"
                >
                  <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                    <Bell size={18} className="text-slate-400" />
                    <span className="font-semibold text-white">Notifications</span>
                  </div>
                  <div className="overflow-y-auto flex-1 p-2">
                    {notificationsLoading ? (
                      <p className="text-slate-400 text-sm py-6 text-center">Chargement…</p>
                    ) : notificationsList.length === 0 ? (
                      <p className="text-slate-400 text-sm py-6 text-center">Aucune notification.</p>
                    ) : (
                      <ul className="space-y-2">
                        {notificationsList.map((n) => (
                          <li key={n._id} className="p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-left">
                            <p className="font-medium text-white text-sm">{n.title || 'Sans titre'}</p>
                            {n.message ? <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</p> : null}
                            {n.createdAt ? <p className="text-xs text-slate-500 mt-1">{new Date(n.createdAt).toLocaleString(language === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</p> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button type="button" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label={t('common.brightness')}>
            <Sun size={20} />
          </button>
          <button type="button" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 hidden sm:block" aria-label={t('common.search')}>
            <Search size={20} />
          </button>
          <button type="button" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 hidden sm:block" aria-label={t('common.settings')}>
            <Settings size={20} />
          </button>
          <button type="button" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label={t('common.help')}>
            <HelpCircle size={20} />
          </button>
          <div className="ml-1">
            <LanguageSelector />
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label={t('common.menu')}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* ——— Sidebar catégories (desktop) ——— */}
        <AnimatePresence>
          {(sidebarOpen || menuOpen) && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="hidden lg:flex flex-col flex-shrink-0 w-60 bg-slate-800/80 border-r border-slate-700/50 overflow-hidden"
            >
              <nav className="p-2 space-y-0.5 overflow-y-auto">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = activeCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => { setActiveCategory(cat.key); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                      }`}
                    >
                      <Icon size={22} className="flex-shrink-0" />
                      <span className="font-medium text-sm truncate">{t(cat.labelKey)}</span>
                    </button>
                  );
                })}
              </nav>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Menu mobile plein écran (catégories) ——— */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40 bg-slate-900/98 backdrop-blur-sm pt-16 pb-24 px-4 overflow-y-auto"
            >
              <nav className="grid grid-cols-2 gap-2 py-4">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = activeCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => { setActiveCategory(cat.key); setMenuOpen(false); }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                        isActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      <Icon size={24} className="flex-shrink-0" />
                      <span className="font-medium text-sm">{t(cat.labelKey)}</span>
                    </button>
                  );
                })}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ——— Zone centrale : liste + détail (desktop) / liste seule (mobile) ——— */}
        <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Liste des chaînes / services */}
          <div className="flex-shrink-0 lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-r border-slate-700/50 overflow-y-auto bg-slate-800/40">
            <div className="p-3 md:p-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">
                {t(categories.find((c) => c.key === activeCategory)?.labelKey || 'common.webtv')}
              </h2>
              <ul className="space-y-2">
                {channels.map((ch) => {
                  const isSelected = selectedChannel?.id === ch.id;
                  return (
                    <li key={ch.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedChannel(ch)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                          isSelected
                            ? 'bg-blue-600/90 text-white ring-1 ring-blue-400'
                            : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700/80'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                          <Play size={18} className={isSelected ? 'text-white' : 'text-slate-400'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{ch.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{ch.views} vues</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {ch.live && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/90 text-white">
                              Live
                            </span>
                          )}
                          {ch.hd && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-600 text-slate-200">
                              HD
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Panneau détail (desktop) ou bloc détail (mobile après sélection) */}
          <div className="flex-1 min-h-[280px] lg:min-h-0 overflow-y-auto bg-slate-900">
            {selectedChannel ? (
              <div className="p-4 md:p-6 lg:p-8">
                <div className="relative rounded-2xl overflow-hidden bg-slate-800 aspect-video max-h-[320px] lg:max-h-none">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 to-slate-900 flex items-center justify-center">
                    <span className="text-6xl opacity-50">🚢</span>
                  </div>
                  <div className="absolute top-3 left-3 flex gap-2">
                    {selectedChannel.live && (
                      <span className="px-2 py-1 rounded-md text-xs font-bold bg-red-500 text-white">
                        Live
                      </span>
                    )}
                    {selectedChannel.hd && (
                      <span className="px-2 py-1 rounded-md text-xs font-semibold bg-slate-600/90 text-slate-200">
                        HD
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <h3 className="text-xl font-bold text-white">{selectedChannel.name}</h3>
                  </div>
                </div>
                <p className="mt-4 text-slate-300 text-sm md:text-base leading-relaxed">
                  {selectedChannel.desc}
                </p>
                <a
                  href={`/?#${activeCategory}`}
                  className="mt-6 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
                >
                  <Play size={18} />
                  Accéder au service
                </a>
              </div>
            ) : (
              <div className="p-8 flex items-center justify-center text-slate-500">
                <p>Sélectionnez un élément dans la liste.</p>
              </div>
            )}
          </div>
        </main>

        {/* ——— Bottom bar (mobile) ——— */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center">
          <nav className="w-full max-w-[768px] flex items-center justify-around py-2 px-2 bg-slate-900 border-t border-slate-700 safe-area-pb">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === 'more' ? false : activeCategory === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    if (item.key === 'more') setMenuOpen(true);
                    else setActiveCategory(item.key);
                  }}
                  className={`flex flex-col items-center justify-center flex-1 min-w-0 py-2 px-1 transition-colors ${
                    isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Icon size={22} />
                  <span className="text-[10px] mt-1 font-medium">
                    {item.key === 'more' ? t('common.services') : t(item.labelKey)}
                  </span>
                </button>
              );
            })}
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
              {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </nav>
        </div>
      </div>

      {/* Padding bas pour éviter que le contenu soit sous la bottom bar */}
      <div className="h-16 lg:hidden" aria-hidden />
    </div>
  );
}
