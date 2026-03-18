/**
 * Contenu de la page Favoris — listes par catégorie (shop, films, magazine, enfant, restaurants).
 * Extrait d'App.jsx pour alléger le composant principal (audit CTO).
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Heart, ShoppingBag, Clapperboard, BookOpen, Baby, Utensils, ChevronRight, Trash2 } from 'lucide-react';

export default function FavoritesPageContent({
  pageTitleFavorites,
  shopFavorites,
  myWatchlist,
  magazineFavoritesArticles,
  enfantFavoritesActivities,
  restaurantFavoritesList,
  shopCategories,
  magazineCategories,
  t,
  language,
  setPage,
  setMovieToOpenFromFavorites,
  setSelectedArticle,
  setSelectedActivity,
  setSelectedRestaurant,
  removeFromShopFavorites,
  getPosterUrl,
  getRadioLogoUrl,
  defaultRestaurantImage,
}) {
  const totalCount =
    shopFavorites.length +
    myWatchlist.length +
    magazineFavoritesArticles.length +
    enfantFavoritesActivities.length +
    restaurantFavoritesList.length;

  return (
    <motion.div
      key="favorites"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20"
    >
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-5 py-6 sm:py-8 space-y-6">
        <div className="relative rounded-2xl overflow-hidden shadow-xl" style={{ backgroundColor: '#264FFF' }}>
          <div className="px-5 py-6 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex-shrink-0">
              <Heart size={28} className="text-white fill-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">{pageTitleFavorites}</h1>
              <p className="text-sm text-white/90 mt-0.5">
                {totalCount} élément{totalCount !== 1 ? 's' : ''} en favori{totalCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {shopFavorites.length > 0 && (
            <section className="rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2" style={{ backgroundColor: '#264FFF' }}>
                <ShoppingBag size={20} className="text-white" />
                <h2 className="text-lg font-bold text-white">{t('shop.title')}</h2>
              </div>
              <div className="p-4 space-y-6">
                {shopCategories.filter((c) => c.id !== 'all').map((cat) => {
                  const items = shopFavorites.filter((p) => p.category === cat.id);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat.id}>
                      <h3 className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-2">
                        <span>{cat.icon}</span> {cat.name}
                      </h3>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <motion.div
                            key={item.id}
                            layout
                            className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
                          >
                            <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-rose-100 flex-shrink-0">
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" decoding="async" onError={(e) => { e.target.style.display = 'none'; }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 line-clamp-1">{item.name}</p>
                              <p className="text-sm font-bold text-rose-600">{item.price.toFixed(2)}€</p>
                            </div>
                            <button
                              onClick={() => removeFromShopFavorites(item.id)}
                              className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {(() => {
                  const items = shopFavorites.filter((p) => !p.category || p.category === 'all');
                  if (items.length === 0) return null;
                  return (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-500 mb-2">{t('shop.categories.all')}</h3>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <motion.div key={item.id} layout className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-rose-100 flex-shrink-0">
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" decoding="async" onError={(e) => { e.target.style.display = 'none'; }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 line-clamp-1">{item.name}</p>
                              <p className="text-sm font-bold text-rose-600">{item.price.toFixed(2)}€</p>
                            </div>
                            <button onClick={() => removeFromShopFavorites(item.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg">
                              <Trash2 size={18} />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </section>
          )}

          {myWatchlist.length > 0 && (
            <section className="rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2" style={{ backgroundColor: '#264FFF' }}>
                <Clapperboard size={20} className="text-white" />
                <h2 className="text-lg font-bold text-white">{t('common.movies')}</h2>
              </div>
              <div className="p-4 space-y-2">
                {myWatchlist.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    onClick={() => { setMovieToOpenFromFavorites(item); setPage('movies'); }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                      {item.poster ? (
                        <img src={getPosterUrl(item.poster)} alt={(item.translations?.[language]?.title) ?? item.title} className="w-full h-full object-cover object-center" loading="lazy" decoding="async" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Clapperboard size={24} className="text-slate-500" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 line-clamp-1">{(item.translations?.[language]?.title) ?? item.title}</p>
                      <p className="text-xs text-slate-500">{item.type === 'film' ? t('movies.films') : t('movies.series')} · {item.year}</p>
                    </div>
                    <ChevronRight size={18} className="text-slate-500 flex-shrink-0" />
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {magazineFavoritesArticles.length > 0 && (
            <section className="rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2" style={{ backgroundColor: '#264FFF' }}>
                <BookOpen size={20} className="text-white" />
                <h2 className="text-lg font-bold text-white">{t('common.magazine')}</h2>
              </div>
              <div className="p-4 space-y-2">
                {magazineFavoritesArticles.map((article) => (
                  <motion.div
                    key={article.id ?? article._id}
                    layout
                    onClick={() => { setSelectedArticle(article); setPage('magazine'); }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                      {article.image ? (
                        <img src={getPosterUrl(article.image) || article.image} alt={article.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><BookOpen size={24} className="text-slate-500" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 line-clamp-1">{article.title}</p>
                      <p className="text-xs text-slate-500">{magazineCategories.find((c) => c.id === article.category)?.name || article.category}</p>
                    </div>
                    <ChevronRight size={18} className="text-slate-500 flex-shrink-0" />
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {enfantFavoritesActivities.length > 0 && (
            <section className="rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2" style={{ backgroundColor: '#264FFF' }}>
                <Baby size={20} className="text-white" />
                <h2 className="text-lg font-bold text-white">{t('enfant.title')}</h2>
              </div>
              <div className="p-4 space-y-2">
                {enfantFavoritesActivities.map((activity) => (
                  <motion.div
                    key={activity.id}
                    layout
                    onClick={() => { setSelectedActivity(activity); setPage('enfant'); }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                      {activity.image ? (
                        <img src={activity.image} alt={activity.name} className="w-full h-full object-cover object-center" loading="lazy" decoding="async" onError={(e) => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Baby size={24} className="text-slate-500" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 line-clamp-1">{activity.name}</p>
                      <p className="text-xs text-slate-500">{activity.ageRange}{activity.openingHours ? ` · ${activity.openingHours}` : ''}</p>
                    </div>
                    <ChevronRight size={18} className="text-slate-500 flex-shrink-0" />
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {restaurantFavoritesList.length > 0 && (
            <section className="rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2" style={{ backgroundColor: '#264FFF' }}>
                <Utensils size={20} className="text-white" />
                <h2 className="text-lg font-bold text-white">{t('restaurants.title')}</h2>
              </div>
              <div className="p-4 space-y-2">
                {restaurantFavoritesList.map((restaurant) => (
                  <motion.div
                    key={restaurant.id}
                    layout
                    onClick={() => { setSelectedRestaurant(restaurant); setPage('restaurant'); }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                      <img src={getRadioLogoUrl(restaurant.image) || restaurant.image || defaultRestaurantImage} alt={restaurant.name} className="w-full h-full object-cover object-center" loading="lazy" decoding="async" onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 line-clamp-1">{restaurant.name}</p>
                      <p className="text-xs text-slate-500">{restaurant.location}{restaurant.priceRange ? ` · ${restaurant.priceRange}` : ''}</p>
                    </div>
                    <ChevronRight size={18} className="text-slate-500 flex-shrink-0" />
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {totalCount === 0 && (
            <div className="rounded-2xl bg-white shadow-lg border border-slate-100 p-8 text-center">
              <Heart size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-600 font-medium">{t('common.noFavoritesYet')}</p>
              <p className="text-sm text-slate-500 mt-1">{t('shop.favoritesEmptyHint')}</p>
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                <button onClick={() => setPage('shop')} className="px-4 py-2 rounded-xl font-medium text-white" style={{ backgroundColor: '#264FFF' }}>{t('common.shop')}</button>
                <button onClick={() => setPage('movies')} className="px-4 py-2 rounded-xl font-medium text-white" style={{ backgroundColor: '#264FFF' }}>{t('common.movies')}</button>
                <button onClick={() => setPage('magazine')} className="px-4 py-2 rounded-xl font-medium text-white" style={{ backgroundColor: '#264FFF' }}>{t('common.magazine')}</button>
                <button onClick={() => setPage('restaurant')} className="px-4 py-2 rounded-xl font-medium text-white" style={{ backgroundColor: '#264FFF' }}>{t('restaurants.title')}</button>
                <button onClick={() => setPage('enfant')} className="px-4 py-2 rounded-xl font-medium text-white" style={{ backgroundColor: '#264FFF' }}>{t('enfant.title')}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
