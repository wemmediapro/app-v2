/**
 * Page Espace Enfant — extraite d'App.jsx (audit CTO, lazy load).
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Baby, Heart, ChevronRight, Clock, MapPin, X } from 'lucide-react';

export default function EnfantPage(props) {
  const {
    t,
    enfantActivities,
    enfantLoading,
    selectedEnfantCategory,
    setSelectedEnfantCategory,
    enfantCategories,
    enfantHighlights,
    filteredEnfantActivities,
    selectedActivity,
    setSelectedActivity,
    isEnfantFavorite,
    toggleEnfantFavorite,
  } = props;
  return (
    <motion.div
      key="enfant"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-pink-50/30 to-slate-100/80"
    >
      <div className="mx-auto w-full max-w-full md:max-w-2xl lg:max-w-4xl px-4 sm:px-5 lg:px-6 py-5 sm:py-6 space-y-6 sm:space-y-7">
        {/* Header - même style que magazine */}
        <header className="rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 px-5 py-4 sm:px-6 sm:py-5 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex-shrink-0">
              <Baby size={24} className="text-white sm:w-7 sm:h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">{t('enfant.title')}</h1>
              <p className="text-xs sm:text-sm text-white/90 mt-0.5 line-clamp-2">
                {t('enfant.zoneFamilies')} — {t('enfant.zoneFamiliesSubtitle')}
              </p>
              {enfantActivities.length > 0 && (
                <p className="text-xs text-white/80 mt-1.5">
                  {enfantActivities.length} {t('enfant.activities').toLowerCase()}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Loading State - squelette comme magazine */}
        {enfantLoading && (
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex gap-3">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3" />
                </div>
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded animate-pulse w-4/5" />
                    <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center py-8 border-t border-slate-100">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-pink-500/20 border-t-pink-500" />
              <p className="ml-3 text-slate-600 text-sm">{t('magazine.loading')}</p>
            </div>
          </div>
        )}

        {!enfantLoading && (
          <>
            {/* Catégories — menu déroulant (tous écrans) */}
            <div className="w-full max-w-xs">
              <select
                value={selectedEnfantCategory}
                onChange={(e) => setSelectedEnfantCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-white border border-slate-200/80 text-slate-700 focus:outline-none focus:ring-2 focus:ring-pink-500/25 focus:border-pink-500"
              >
                {enfantCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* À la une */}
            {enfantHighlights.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">{t('enfant.featured')}</h2>
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-pink-100 text-pink-600">
                    {enfantHighlights.length} {t('enfant.programs')}
                  </span>
                </div>
                <div className="space-y-3">
                  {enfantHighlights.map((highlight) => {
                    const categoryLabel = enfantCategories.find((cat) => cat.id === highlight.category)?.name || highlight.category;
                    const featureSummary = highlight.features?.slice(0, 2).join(' • ');
                    return (
                      <motion.div
                        key={highlight.id}
                        role="button"
                        tabIndex={0}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className="w-full flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 text-left shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => setSelectedActivity(highlight)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedActivity(highlight); } }}
                      >
                        <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-xl overflow-hidden bg-slate-200 flex-shrink-0">
                          <img
                            src={highlight.image}
                            alt={highlight.name}
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 w-full h-full object-cover object-center"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextElementSibling?.style && (e.target.nextElementSibling.style.display = 'flex');
                            }}
                          />
                          <div className="absolute inset-0 hidden items-center justify-center text-white bg-pink-500/70">
                            <Baby size={24} />
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleEnfantFavorite(highlight); }}
                            className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-white/90 text-slate-500 hover:bg-white shadow border border-slate-100"
                            aria-label={isEnfantFavorite(highlight.id) ? t('common.removeFromFavorites') : t('common.addToFavorites')}
                          >
                            <Heart size={16} className={isEnfantFavorite(highlight.id) ? 'text-rose-500 fill-rose-500' : ''} strokeWidth={1.75} />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs uppercase tracking-wider text-pink-500 font-semibold">{categoryLabel}</p>
                          <h3 className="text-sm sm:text-base font-semibold text-slate-900 mt-0.5 line-clamp-2">{highlight.name}</h3>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{highlight.description}</p>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2 flex-wrap">
                            <span>🕒 {highlight.openingHours}</span>
                            {highlight.ageRange && <span>👶 {highlight.ageRange}</span>}
                            {featureSummary && <span>{featureSummary}</span>}
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-slate-300 flex-shrink-0 mt-1" />
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Toutes les activités - grille cartes */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-semibold text-slate-900">{t('enfant.allActivities')}</h2>
                <span className="text-xs font-semibold text-slate-500">
                  {filteredEnfantActivities.length} {t('enfant.activities').toLowerCase()}
                </span>
              </div>
              {filteredEnfantActivities.length > 0 ? (
                <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredEnfantActivities.map((activity) => (
                    <motion.div
                      key={activity.id}
                      role="button"
                      tabIndex={0}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="rounded-2xl bg-white shadow-md border border-slate-100 overflow-hidden text-left hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => setSelectedActivity(activity)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedActivity(activity); } }}
                    >
                      <div className="relative aspect-[16/10] sm:aspect-video bg-slate-200">
                        <img
                          src={activity.image}
                          alt={activity.name}
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 w-full h-full object-cover object-center"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextElementSibling?.style && (e.target.nextElementSibling.style.display = 'flex');
                          }}
                        />
                        <div className="absolute inset-0 hidden items-center justify-center text-4xl text-white bg-pink-500/60">
                          <Baby size={40} />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                          <span className="px-2 py-1 rounded-lg bg-pink-500 text-white text-xs font-semibold">
                            {activity.ageRange}
                          </span>
                          <div className="flex items-center gap-1">
                            {activity.isOpen !== false && (
                              <span className="px-2 py-1 rounded-lg bg-green-500/90 text-white text-xs font-semibold">{t('shipmap.serviceOpen')}</span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleEnfantFavorite(activity); }}
                              className="p-1.5 rounded-full bg-white/90 text-slate-500 hover:bg-white shadow border border-slate-100"
                              aria-label={isEnfantFavorite(activity.id) ? t('common.removeFromFavorites') : t('common.addToFavorites')}
                            >
                              <Heart size={16} className={isEnfantFavorite(activity.id) ? 'text-rose-500 fill-rose-500' : ''} strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="text-sm sm:text-base font-semibold text-slate-900 line-clamp-2">{activity.name}</h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{activity.description}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                          <Clock size={14} className="text-pink-500 flex-shrink-0" />
                          <span>{activity.openingHours}</span>
                        </div>
                        {activity.features && activity.features.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {activity.features.slice(0, 3).map((f, i) => (
                              <span key={i} className="px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 text-[11px] font-medium">
                                {f}
                              </span>
                            ))}
                            {activity.features.length > 3 && (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px]">+{activity.features.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <div className="rounded-2xl bg-white border border-slate-100 px-5 py-10 text-center">
                  <Baby size={48} className="mx-auto text-slate-300" />
                  <p className="text-slate-500 font-medium mt-3">
                    {selectedEnfantCategory === 'favoris' ? t('enfant.noFavorites') : t('enfant.noActivitiesInCategory')}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedEnfantCategory === 'favoris' ? t('enfant.noFavoritesHint') : t('enfant.noActivitiesInCategoryHint')}
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full flex justify-center max-w-full sm:max-w-2xl md:max-w-xl"
          >
            <div className="w-full flex-shrink-0 max-w-full">
              <div className="rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="relative h-48 sm:h-56 bg-slate-200 flex-shrink-0">
                  <img
                    src={selectedActivity.image}
                    alt={selectedActivity.name}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling?.style && (e.target.nextElementSibling.style.display = 'flex');
                    }}
                  />
                  <div className="absolute inset-0 hidden items-center justify-center text-4xl text-white bg-pink-500/60">
                    <Baby size={48} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedActivity(null)}
                    className="absolute top-4 right-4 p-2 rounded-full bg-white/90 text-slate-600 hover:bg-white shadow"
                  >
                    <X size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => selectedActivity && toggleEnfantFavorite(selectedActivity)}
                    className="absolute top-4 right-14 p-2 rounded-full bg-white/90 text-slate-600 hover:bg-white shadow"
                    aria-label={selectedActivity && isEnfantFavorite(selectedActivity.id) ? t('common.removeFromFavorites') : t('common.addToFavorites')}
                  >
                    <Heart size={20} className={selectedActivity && isEnfantFavorite(selectedActivity.id) ? 'text-rose-500 fill-rose-500' : ''} strokeWidth={1.75} />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent text-white">
                    <p className="text-xs uppercase tracking-wider text-white/80">{enfantCategories.find(c => c.id === selectedActivity.category)?.name || selectedActivity.category}</p>
                    <h2 className="text-xl sm:text-2xl font-bold leading-tight mt-1">{selectedActivity.name}</h2>
                    <div className="flex items-center gap-3 text-xs text-white/90 mt-2">
                      <MapPin size={14} />
                      <span>{selectedActivity.location}</span>
                      <span>·</span>
                      <span>👶 {selectedActivity.ageRange}</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                  <p className="text-sm text-slate-600 leading-relaxed">{selectedActivity.description}</p>
                  {selectedActivity.activities && selectedActivity.activities.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Animations proposées</h3>
                      <div className="space-y-2">
                        {selectedActivity.activities.map((sub, idx) => (
                          <div key={idx} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                            <div className="w-12 h-12 rounded-lg bg-slate-200 flex-shrink-0 flex items-center justify-center text-xl">🎨</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="text-sm font-semibold text-slate-900">{sub.name}</h4>
                                {sub.duration && <span className="text-xs font-semibold text-pink-500">{sub.duration}</span>}
                              </div>
                              {sub.description && <p className="text-xs text-slate-500 mt-0.5">{sub.description}</p>}
                              {sub.ageRange && <p className="text-[11px] text-slate-500 mt-1">👶 {sub.ageRange}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                    <div className="flex items-start gap-3 text-sm text-slate-600">
                      <Clock size={18} className="text-pink-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-900">Horaires</p>
                        <p>{selectedActivity.openingHours}</p>
                      </div>
                    </div>
                    {selectedActivity.features && selectedActivity.features.length > 0 && (
                      <>
                        <p className="text-sm font-semibold text-slate-900 mt-2">Équipements</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedActivity.features.map((feature, index) => (
                            <span key={index} className="px-3 py-1 rounded-full bg-pink-100 text-pink-600 text-xs font-medium">
                              {feature}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>

  );
}
