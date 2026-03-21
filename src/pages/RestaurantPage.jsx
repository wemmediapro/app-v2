/**
 * Page Restaurants — extraite d'App.jsx (audit CTO, lazy load).
 */
import React from 'react';
import { motion } from 'framer-motion';
import {
  Ship,
  Utensils,
  Clock,
  Star,
  MapPin,
  Search,
  ChevronRight,
  Heart,
  X,
  Minus,
  Plus,
  ShoppingBag,
  ArrowLeft,
} from 'lucide-react';
import { getPosterUrl, getRadioLogoUrl } from '../services/apiService';

export default function RestaurantPage(props) {
  const {
    currentShipName,
    t,
    restaurants,
    restaurantSearchQuery,
    setRestaurantSearchQuery,
    selectedRestaurantCategory,
    setSelectedRestaurantCategory,
    restaurantCategories,
    allPromotions,
    getPromoTitle,
    getPromoDescription,
    filteredRestaurants,
    restaurantsLoading,
    setSelectedRestaurant,
    selectedRestaurant,
    DEFAULT_RESTAURANT_IMAGE,
    getRadioLogoUrl,
    isRestaurantFavorite,
    toggleRestaurantFavorite,
    getPosterUrl,
    setPage,
    cart,
    addToCart,
  } = props;
  return (
    <motion.div
      key="restaurant"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-slate-50"
    >
      <div className="mx-auto w-full max-w-full px-3 py-6 space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow px-4 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Ship size={22} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-white/70">{currentShipName}</p>
              <p className="text-base font-semibold">{t('restaurants.deckVillage')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-white/80">
            <div className="flex items-center gap-1">
              <Utensils size={14} />
              <span>
                {restaurants.length} {restaurants.length === 1 ? t('restaurants.space') : t('restaurants.spaces')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span>{t('restaurants.continuousService')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star size={14} className="text-yellow-300" />
              <span>{t('restaurants.averageRating')}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin size={14} />
              <span>{t('restaurants.loungeAccess')}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white shadow px-4 py-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={t('restaurants.searchPlaceholder')}
              value={restaurantSearchQuery}
              onChange={(e) => setRestaurantSearchQuery(e.target.value)}
              className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
            {(restaurantSearchQuery || selectedRestaurantCategory !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setRestaurantSearchQuery('');
                  setSelectedRestaurantCategory('all');
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label={t('common.clearSearchAndFilters')}
              >
                <X size={18} />
              </button>
            )}
          </div>
          <button className="relative h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500">
            <ShoppingBag size={18} />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-semibold rounded-full px-1.5">
                {cart.length}
              </span>
            )}
          </button>
        </div>

        {/* Catégories — liste déroulante (visible tous breakpoints pour cohérence + E2E) */}
        <div className="w-full md:max-w-md">
          <select
            name="category"
            data-testid="restaurant-category-filter"
            aria-label={t('restaurants.title')}
            value={selectedRestaurantCategory}
            onChange={(e) => setSelectedRestaurantCategory(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-white border border-slate-200/80 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
          >
            {restaurantCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </select>
        </div>

        {selectedRestaurant ? (
          // Vue détaillée du restaurant avec menu complet
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Header avec bouton retour + favori */}
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => {
                  setPage('restaurant');
                  setSelectedRestaurant(null);
                }}
                className="flex-shrink-0 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/90 sm:bg-slate-100 text-slate-600 hover:text-slate-800 hover:bg-slate-200 active:scale-95 transition-all shadow-sm border border-slate-200/80"
                aria-label={t('common.back')}
              >
                <ArrowLeft size={20} className="sm:w-5 sm:h-5" strokeWidth={2.25} />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-slate-900 truncate">{selectedRestaurant.name}</h2>
                <p className="text-sm text-slate-500 truncate">{selectedRestaurant.location}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRestaurantFavorite(selectedRestaurant.id);
                }}
                className={`rounded-full p-2 transition-colors ${isRestaurantFavorite(selectedRestaurant.id) ? 'bg-rose-100 text-rose-500' : 'bg-slate-100 text-slate-500 hover:text-rose-500 hover:bg-rose-50'}`}
                aria-label={
                  isRestaurantFavorite(selectedRestaurant.id)
                    ? t('common.removeFromFavorites')
                    : t('common.addToFavorites')
                }
              >
                <Heart size={20} className={isRestaurantFavorite(selectedRestaurant.id) ? 'fill-current' : ''} />
              </button>
            </div>

            {/* Image du restaurant */}
            <div className="relative h-48 bg-slate-200 rounded-2xl overflow-hidden">
              <img
                src={getRadioLogoUrl(selectedRestaurant.image) || selectedRestaurant.image || DEFAULT_RESTAURANT_IMAGE}
                alt={selectedRestaurant.name}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover object-center"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              <div className="absolute inset-0 hidden items-center justify-center text-white bg-gradient-to-br from-orange-500/70 to-rose-500/70">
                <Utensils size={32} />
              </div>
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
                  {selectedRestaurant.type}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    selectedRestaurant.isOpen ? 'bg-green-500 text-white' : 'bg-rose-500 text-white'
                  }`}
                >
                  {selectedRestaurant.isOpen ? t('shipmap.serviceOpen') : t('shipmap.serviceClosed')}
                </span>
              </div>
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1">
                <Star size={14} className="text-yellow-400 fill-current" />
                <span className="text-sm font-semibold text-slate-700">{selectedRestaurant.rating}</span>
              </div>
            </div>

            {/* Informations du restaurant */}
            <div className="bg-white rounded-2xl shadow p-4 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{t('restaurants.about')}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{selectedRestaurant.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                <div>
                  <p className="text-xs text-slate-500 mb-1">{t('restaurants.price')}</p>
                  <p className="text-base font-semibold text-orange-500">{selectedRestaurant.priceRange}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">{t('restaurants.hours')}</p>
                  <p className="text-sm font-medium text-slate-700">{selectedRestaurant.openingHours}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-2">{t('restaurants.specialties')}</p>
                <div className="flex flex-wrap gap-2">
                  {selectedRestaurant.specialties.map((specialty) => (
                    <span
                      key={specialty}
                      className="px-3 py-1 rounded-full bg-orange-50 text-orange-600 text-xs font-medium"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Promotions */}
            {selectedRestaurant.promotions && selectedRestaurant.promotions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-slate-900">{t('restaurants.promotions')}</h3>
                <div className="space-y-3">
                  {selectedRestaurant.promotions.map((promo, idx) => (
                    <div
                      key={promo.id != null ? promo.id : `promo-detail-${idx}`}
                      className="rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-4 shadow flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <p className="text-base font-semibold">{getPromoTitle(promo)}</p>
                        <p className="text-sm text-white/80 mt-1">{getPromoDescription(promo)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{promo.price}€</p>
                        {promo.originalPrice != null && !isNaN(promo.originalPrice) && (
                          <p className="text-sm line-through text-white/70">{promo.originalPrice}€</p>
                        )}
                        {promo.discount != null && !isNaN(promo.discount) && (
                          <p className="text-xs font-semibold bg-white/20 px-2 py-1 rounded-full mt-2">
                            -{promo.discount}%
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Menu complet */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900">{t('restaurants.fullMenu')}</h3>
              {(() => {
                const menuByCategory = (selectedRestaurant.menu || []).reduce((acc, item) => {
                  const category = item.category || 'other';
                  if (!acc[category]) acc[category] = [];
                  acc[category].push(item);
                  return acc;
                }, {});
                const getCategoryLabel = (cat) => {
                  const key =
                    'restaurants.categories.' + (cat && typeof cat === 'string' ? cat.toLowerCase() : 'other');
                  const out = t(key);
                  return out && out !== key ? out : cat || t('restaurants.categories.other');
                };

                return Object.entries(menuByCategory).map(([category, items]) => (
                  <div key={category} className="bg-white rounded-2xl shadow p-4 space-y-4">
                    <h4 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-2">
                      {getCategoryLabel(category)}
                    </h4>
                    <div className="space-y-4">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0"
                        >
                          <div className="relative h-24 w-24 rounded-xl overflow-hidden bg-slate-200 flex-shrink-0">
                            <img
                              src={getPosterUrl(item.image) || item.image}
                              alt={item.name}
                              loading="lazy"
                              decoding="async"
                              className="absolute inset-0 w-full h-full object-cover object-center"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            />
                            <div className="absolute inset-0 hidden items-center justify-center text-slate-500 bg-white">
                              <Utensils size={20} />
                            </div>
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="text-base font-semibold text-slate-900">{item.name}</h5>
                                  {item.isPopular && (
                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-semibold rounded-full">
                                      {t('restaurants.popular')}
                                    </span>
                                  )}
                                </div>
                                {item.description && <p className="text-sm text-slate-500 mt-1">{item.description}</p>}
                              </div>
                              <div className="text-right">
                                {item.price && <p className="text-lg font-bold text-orange-500">{item.price}€</p>}
                              </div>
                            </div>
                            {item.allergens && item.allergens.length > 0 && (
                              <p className="text-xs text-slate-500">
                                {t('restaurants.allergens')} : {item.allergens.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </motion.div>
        ) : (
          // Liste des restaurants
          <>
            {/* Module Promotions — 3 colonnes (3 blocs par ligne), bloc orange, sans image */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900">{t('restaurants.promotions')}</h2>
              {allPromotions.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allPromotions.map((promo, idx) => {
                    const restaurant = promo.restaurant;
                    const promoTitle = getPromoTitle(promo);
                    const hasDiscount = promo.discount != null && !isNaN(promo.discount);
                    return (
                      <motion.button
                        key={promo.id != null ? promo.id : `promo-${restaurant?.id ?? idx}-${idx}`}
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => restaurant && setSelectedRestaurant(restaurant)}
                        className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md border border-orange-400/30 px-4 py-3 text-left hover:from-orange-600 hover:to-red-600 transition-colors"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
                          {promo.restaurantName}
                        </p>
                        <p className="text-sm font-semibold mt-1 line-clamp-2">{promoTitle}</p>
                        <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-base font-bold">
                            {Number(promo.price) != null && !isNaN(promo.price) ? `${promo.price}€` : '—'}
                            {promo.originalPrice != null && !isNaN(promo.originalPrice) && (
                              <span className="text-xs font-normal opacity-80 line-through ml-1">
                                {promo.originalPrice}€
                              </span>
                            )}
                          </span>
                          {hasDiscount && (
                            <span className="text-xs font-bold bg-white/25 px-2 py-0.5 rounded-full">
                              -{promo.discount}%
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-white/80 mt-2 flex items-center gap-0.5">
                          {t('restaurants.viewRestaurant')}
                          <ChevronRight size={12} />
                        </p>
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl bg-gradient-to-r from-orange-500/90 to-red-500/90 text-white px-4 py-4 text-center border border-orange-400/30">
                  <p className="text-sm font-medium">{t('restaurants.noPromotions')}</p>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">{t('restaurants.gnvSelection')}</h2>
              <div className="space-y-3">
                {restaurantsLoading ? (
                  <div
                    className="rounded-2xl bg-white border border-slate-200 p-6 text-center"
                    data-testid="restaurant-list-loading"
                  >
                    <p className="text-slate-500">{t('common.loading') || 'Chargement...'}</p>
                  </div>
                ) : filteredRestaurants.length === 0 ? (
                  <div
                    className="rounded-2xl bg-white border border-slate-200 p-6 text-center text-slate-500"
                    data-testid="restaurant-list-empty"
                  >
                    <Utensils size={40} className="mx-auto mb-2 opacity-50" />
                    <p className="font-medium">{t('restaurants.noRestaurantsToShow')}</p>
                    <p className="text-sm mt-1">{t('restaurants.checkFiltersHint')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredRestaurants.map((restaurant) => (
                      <motion.div
                        key={restaurant.id}
                        data-testid="restaurant-card"
                        whileHover={{ scale: 1.01 }}
                        className="w-full rounded-2xl bg-white shadow border border-slate-200 overflow-hidden"
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedRestaurant(restaurant)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedRestaurant(restaurant);
                            }
                          }}
                          className="w-full text-left cursor-pointer"
                        >
                          <div className="relative h-36 bg-slate-200">
                            <img
                              src={getRadioLogoUrl(restaurant.image) || restaurant.image || DEFAULT_RESTAURANT_IMAGE}
                              alt={restaurant.name}
                              loading="lazy"
                              decoding="async"
                              className="absolute inset-0 w-full h-full object-cover object-center"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            />
                            <div className="absolute inset-0 hidden items-center justify-center text-white bg-gradient-to-br from-orange-500/70 to-rose-500/70">
                              <Utensils size={28} />
                            </div>
                            <div className="absolute top-3 left-3 flex items-center gap-2">
                              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                {restaurant.type}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  restaurant.isOpen ? 'bg-green-500 text-white' : 'bg-rose-500 text-white'
                                }`}
                              >
                                {restaurant.isOpen ? t('shipmap.serviceOpen') : t('shipmap.serviceClosed')}
                              </span>
                            </div>
                            <div className="absolute top-3 right-3 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  toggleRestaurantFavorite(restaurant.id);
                                }}
                                className={`rounded-full p-1.5 transition-colors ${isRestaurantFavorite(restaurant.id) ? 'bg-rose-100 text-rose-500' : 'bg-white/85 backdrop-blur-sm text-slate-600 hover:text-rose-500'}`}
                                aria-label={
                                  isRestaurantFavorite(restaurant.id)
                                    ? t('common.removeFromFavorites')
                                    : t('common.addToFavorites')
                                }
                              >
                                <Heart
                                  size={14}
                                  className={isRestaurantFavorite(restaurant.id) ? 'fill-current' : ''}
                                />
                              </button>
                              <div className="bg-white/85 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Star size={12} className="text-yellow-400 fill-current" />
                                <span className="text-[11px] font-semibold text-slate-700">{restaurant.rating}</span>
                              </div>
                            </div>
                          </div>
                          <div className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-xs text-slate-500 uppercase tracking-[0.3em]">
                                  {restaurant.location}
                                </p>
                                <h3 className="text-lg font-semibold text-slate-900">{restaurant.name}</h3>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                                  {restaurant.description}
                                </p>
                              </div>
                              <div className="text-right text-slate-500 text-xs">
                                <p className="font-semibold text-orange-500">{restaurant.priceRange}</p>
                                <p>{restaurant.location}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {restaurant.specialties.slice(0, 3).map((specialty) => (
                                <span
                                  key={specialty}
                                  className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium"
                                >
                                  {specialty}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                              <p className="text-xs text-slate-500">{restaurant.openingHours}</p>
                              <ChevronRight size={16} className="text-slate-500" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </motion.div>
  );
}
