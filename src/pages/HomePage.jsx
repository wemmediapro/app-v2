/**
 * Page d’accueil — menu services + promos (audit CTO, lazy load).
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Clapperboard, BookOpen, Tv, Utensils, Baby, ShoppingBag, Map, ChevronRight, ArrowRight } from 'lucide-react';

const HOME_SERVICES = [
  { key: 'radio', icon: Mic, titleKey: 'common.radio', glow: 'from-violet-500/10 to-transparent', bgLight: 'bg-violet-50', iconColor: 'text-violet-600' },
  { key: 'movies', icon: Clapperboard, titleKey: 'common.movies', glow: 'from-amber-500/10 to-transparent', bgLight: 'bg-amber-50', iconColor: 'text-amber-600' },
  { key: 'magazine', icon: BookOpen, titleKey: 'common.magazine', glow: 'from-sky-500/10 to-transparent', bgLight: 'bg-sky-50', iconColor: 'text-sky-600' },
  { key: 'webtv', icon: Tv, titleKey: 'common.webtv', glow: 'from-rose-500/10 to-transparent', bgLight: 'bg-rose-50', iconColor: 'text-rose-600' },
  { key: 'restaurant', icon: Utensils, titleKey: 'common.restaurants', glow: 'from-emerald-500/10 to-transparent', bgLight: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  { key: 'enfant', icon: Baby, titleKey: 'common.enfant', glow: 'from-pink-500/10 to-transparent', bgLight: 'bg-pink-50', iconColor: 'text-pink-600' },
  { key: 'shop', icon: ShoppingBag, titleKey: 'common.shop', glow: 'from-slate-500/10 to-transparent', bgLight: 'bg-slate-100', iconColor: 'text-slate-700' },
  { key: 'shipmap', icon: Map, titleKey: 'common.shipmap', glow: 'from-blue-500/10 to-transparent', bgLight: 'bg-blue-50', iconColor: 'text-blue-600' },
];

const QUICK_ACCESS = [
  { key: 'movies', icon: Clapperboard, labelKey: 'common.movies', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  { key: 'magazine', icon: BookOpen, labelKey: 'common.magazine', bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700' },
  { key: 'webtv', icon: Tv, labelKey: 'common.webtv', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
  { key: 'restaurant', icon: Utensils, labelKey: 'common.restaurants', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
];

export default function HomePage({
  t,
  setPage,
  homePromosCombined,
  getPromoTitle,
  getPromoDescription,
  setSelectedRestaurant,
  language,
}) {
  return (
    <div>
      <section className="px-3 sm:px-4 md:px-5 mt-4 sm:mt-6 md:mt-6 pb-3 sm:pb-3 md:pb-4">
        <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden max-w-2xl md:max-w-4xl mx-auto">
          <div className="p-3 sm:p-4 md:p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 md:gap-5 max-w-full">
              {HOME_SERVICES.map((service, index) => {
                const IconComponent = service.icon;
                return (
                  <motion.button
                    key={service.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.25 }}
                    onClick={() => setPage(service.key)}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="group relative min-h-[88px] sm:min-h-[96px] md:min-h-[100px] rounded-2xl p-4 flex flex-col items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-[#264FFF]/40 focus:ring-offset-2 touch-manipulation bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 hover:bg-white hover:shadow-lg hover:shadow-slate-200/50 active:bg-slate-100 transition-all duration-200 overflow-hidden"
                    aria-label={t(service.titleKey)}
                  >
                    <span className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br ${service.glow} pointer-events-none`} aria-hidden />
                    <div className={`relative flex items-center justify-center flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl ${service.bgLight} border border-white/80 shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all duration-200`}>
                      <IconComponent className={`w-7 h-7 sm:w-8 sm:h-8 ${service.iconColor}`} strokeWidth={1.75} />
                    </div>
                    <span className="relative text-slate-700 font-semibold text-xs sm:text-sm text-center leading-tight line-clamp-2 group-hover:text-slate-900 transition-colors">
                      {t(service.titleKey)}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="hidden md:block px-3 sm:px-4 md:px-5 mt-2 md:mt-3 pb-8 md:pb-12 max-w-4xl mx-auto">
        {homePromosCombined.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">{t('common.noResults')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {homePromosCombined.map((promo, index) => {
              if (promo._promoType === 'restaurant') {
                const promoTitle = getPromoTitle(promo);
                const hasDiscount = promo.discount != null && !isNaN(promo.discount);
                return (
                  <motion.button
                    key={promo.id != null ? promo.id : `home-promo-rest-${index}`}
                    type="button"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setPage('restaurant');
                      if (promo.restaurant) setSelectedRestaurant(promo.restaurant);
                    }}
                    className="w-full min-w-0 min-h-[180px] rounded-2xl overflow-hidden border-2 border-orange-200/80 hover:border-orange-400 hover:shadow-xl hover:shadow-orange-200/30 transition-all duration-200 text-left bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 text-white px-5 py-5 shadow-lg flex flex-col"
                    aria-label={promoTitle}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Utensils size={20} className="text-white/70 flex-shrink-0 mt-0.5" strokeWidth={2} />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/90 truncate flex-1 min-w-0 text-right">{promo.restaurantName}</p>
                    </div>
                    <p className="font-bold text-base mt-2 line-clamp-2 leading-snug">{promoTitle}</p>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-bold">{Number(promo.price) != null && !isNaN(promo.price) ? `${promo.price}€` : '—'}</span>
                      {promo.originalPrice != null && !isNaN(promo.originalPrice) && (
                        <span className="text-sm opacity-90 line-through">{promo.originalPrice}€</span>
                      )}
                      {hasDiscount && (
                        <span className="text-xs font-bold bg-white/30 backdrop-blur px-2.5 py-1 rounded-full">-{promo.discount}%</span>
                      )}
                    </div>
                    <p className="text-xs text-white/90 mt-auto pt-4 flex items-center gap-1 font-medium">
                      {t('restaurants.viewRestaurant')}
                      <ArrowRight size={14} className="flex-shrink-0" strokeWidth={2.5} />
                    </p>
                  </motion.button>
                );
              }
              const promoTitle = (promo.translations && promo.translations[language] && promo.translations[language].title) ? promo.translations[language].title : (promo.title || '');
              const promoDesc = (promo.translations && promo.translations[language] && promo.translations[language].description) ? promo.translations[language].description : (promo.description || '');
              const discountLabel = promo.discountType === 'percentage' ? `-${promo.discountValue || 0}%` : `-${promo.discountValue || 0}€`;
              return (
                <motion.button
                  key={promo.id || promo._id || `home-promo-shop-${index}`}
                  type="button"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setPage('shop')}
                  className="w-full min-w-0 min-h-[180px] rounded-2xl overflow-hidden border-2 border-emerald-200/80 hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-200/30 transition-all duration-200 text-left bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white px-5 py-5 shadow-lg flex flex-col"
                  aria-label={promoTitle}
                >
                  <div className="flex items-start justify-between gap-2">
                    <ShoppingBag size={20} className="text-white/70 flex-shrink-0 mt-0.5" strokeWidth={2} />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-wide text-white/90 line-clamp-1 mt-1">{promoTitle}</p>
                  {promoDesc ? <p className="text-xs text-white/90 mt-2 line-clamp-2 leading-relaxed flex-1 min-h-0">{promoDesc}</p> : <span className="flex-1" />}
                  <div className="mt-3">
                    <span className="inline-flex text-sm font-bold bg-white/25 backdrop-blur px-2.5 py-1 rounded-full">{discountLabel}</span>
                  </div>
                  <p className="text-xs text-white/90 mt-auto pt-4 flex items-center gap-1 font-medium">
                    {t('common.seeDetails')}
                    <ArrowRight size={14} className="flex-shrink-0" strokeWidth={2.5} />
                  </p>
                </motion.button>
              );
            })}
          </div>
        )}
      </section>

      <section className="hidden md:block px-3 sm:px-4 md:px-5 mt-4 md:mt-6 pb-8 md:pb-12 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK_ACCESS.map(({ key, icon: Icon, labelKey, bg, border, text }) => (
            <motion.button
              key={key}
              type="button"
              onClick={() => setPage(key)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-3 rounded-xl border-2 ${border} ${bg} px-4 py-3.5 text-left transition-all hover:shadow-md`}
              aria-label={t(labelKey)}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bg} border border-white/80 shadow-sm`}>
                <Icon size={20} className={text} strokeWidth={2} />
              </span>
              <span className={`font-semibold text-sm ${text}`}>{t(labelKey)}</span>
              <ChevronRight size={18} className={`ml-auto ${text} opacity-70`} />
            </motion.button>
          ))}
        </div>
      </section>
    </div>
  );
}
