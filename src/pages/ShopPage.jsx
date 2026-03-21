/**
 * Page Boutique — extraite d’App.jsx (audit CTO, découpage).
 * Utilise useShop pour état + chargement ; favoris gérés via props (synchro App / Favorites).
 */
import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Ship, Clock, Award, Search, ChevronDown, ChevronRight, Heart, Trash2, ChevronLeft, X } from 'lucide-react';
import { useShop } from '../hooks/useShop';

export default function ShopPage({
  t,
  language,
  setPage,
  shopFavorites,
  setShopFavorites,
  favoritesStorageSuffix,
}) {
  const {
    shopProducts,
    shopPromotions,
    shopLoading,
    shopError,
    shopSearchQuery,
    setShopSearchQuery,
    selectedShopCategory,
    setSelectedShopCategory,
    shopCategories,
    filteredShopProducts,
    getProductTypeLabel,
    selectedProduct,
    setSelectedProduct,
    selectedProductImageIndex,
    setSelectedProductImageIndex,
  } = useShop(language, t);

  const isShopFavorite = useCallback((productId) => shopFavorites.some(p => p.id === productId), [shopFavorites]);
  const toggleShopFavorite = useCallback((product) => {
    const key = `shopFavorites_${favoritesStorageSuffix}`;
    setShopFavorites(prev => {
      const next = prev.some(p => p.id === product.id) ? prev.filter(p => p.id !== product.id) : [...prev, { ...product }];
      if (favoritesStorageSuffix === 'guest') try { localStorage.setItem(key, JSON.stringify(next)); } catch (_) {}
      return next;
    });
  }, [favoritesStorageSuffix, setShopFavorites]);
  const removeFromShopFavorites = useCallback((productId) => {
    const key = `shopFavorites_${favoritesStorageSuffix}`;
    setShopFavorites(prev => {
      const next = prev.filter(p => p.id !== productId);
      if (favoritesStorageSuffix === 'guest') try { localStorage.setItem(key, JSON.stringify(next)); } catch (_) {}
      return next;
    });
  }, [favoritesStorageSuffix, setShopFavorites]);

  const closeModal = () => {
    setPage('home');
    setSelectedProduct(null);
    setSelectedProductImageIndex(0);
  };

  return (
    <motion.div
      key="shop"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-slate-50"
    >
      <div className="mx-auto w-full max-w-5xl px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8">
        <header className="space-y-4">
          <div className="rounded-2xl p-4 sm:p-5 shadow-md border border-blue-200/50" style={{ backgroundColor: '#264FFF' }}>
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-white/20 border border-white/30 flex-shrink-0 backdrop-blur-sm">
                <ShoppingBag size={24} className="text-white sm:w-6 sm:h-6" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">{t('shop.pageTitle')}</h1>
                <p className="text-sm text-blue-100 mt-0.5">{t('shop.subtitle')}</p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-white bg-white/20 px-2.5 py-1 rounded-full border border-white/30">
                    <Ship size={12} />
                    {t('shop.deck')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-white bg-white/20 px-2.5 py-1 rounded-full border border-white/30">
                    <Clock size={12} />
                    {t('shop.hours')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-white bg-white/20 px-2.5 py-1 rounded-full border border-white/30">
                    <Award size={12} />
                    {t('shop.officialProducts')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={t('shop.searchPlaceholder')}
              value={shopSearchQuery}
              onChange={(e) => setShopSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-slate-200/80 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all shadow-sm"
            />
          </div>

          <div className="relative">
            <label htmlFor="shop-category" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('shop.categoryLabel')}</label>
            <select
              id="shop-category"
              value={selectedShopCategory}
              onChange={(e) => setSelectedShopCategory(e.target.value)}
              className="w-full appearance-none pl-4 pr-10 py-3 rounded-2xl bg-white border border-slate-200/80 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all shadow-sm [&>option]:text-slate-800"
            >
              {shopCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
            <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        </header>

        {!shopLoading && shopError && (
          <div className="rounded-2xl bg-amber-50/80 border border-amber-200/80 px-4 py-6 text-center">
            <p className="text-amber-800 font-medium text-sm">{t('shop.loadError')}</p>
            <p className="text-xs text-amber-700 mt-1.5">{shopError}</p>
            <p className="text-xs text-amber-600 mt-2 max-w-md mx-auto">{t('shop.loadErrorHint')}</p>
          </div>
        )}

        {shopPromotions.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-500 tracking-widest uppercase">{t('shop.currentPromos')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {shopPromotions.map((promo) => {
                const promoTitle = (promo.translations && promo.translations[language] && promo.translations[language].title) ? promo.translations[language].title : (promo.title || '');
                const promoDesc = (promo.translations && promo.translations[language] && promo.translations[language].description) ? promo.translations[language].description : (promo.description || '');
                const discountLabel = promo.discountType === 'percentage' ? `-${promo.discountValue || 0}%` : `-${promo.discountValue || 0}€`;
                const validFrom = promo.validFrom ? (typeof promo.validFrom === 'string' ? promo.validFrom.slice(0, 10) : promo.validFrom.toISOString?.()?.slice(0, 10)) : '';
                const validUntil = promo.validUntil ? (typeof promo.validUntil === 'string' ? promo.validUntil.slice(0, 10) : promo.validUntil.toISOString?.()?.slice(0, 10)) : '';
                return (
                  <div
                    key={promo.id || promo._id}
                    className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md border border-emerald-400/30 px-4 py-3 text-left"
                  >
                    <p className="text-sm font-semibold mt-0 line-clamp-2">{promoTitle}</p>
                    {promoDesc ? <p className="text-xs text-white/90 mt-1.5 line-clamp-2">{promoDesc}</p> : null}
                    <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-bold bg-white/20 px-2 py-0.5 rounded-full">{discountLabel}</span>
                      {validFrom && validUntil ? (
                        <span className="text-[10px] text-white/80">
                          {validFrom} → {validUntil}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {shopProducts.some((product) => product.isFeatured) && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-500 tracking-widest uppercase">{t('shop.featuredTitle')}</h2>
              <span className="text-xs text-slate-500">{t('shop.featuredSubtitle')}</span>
            </div>
            <div className="space-y-2.5">
              {shopProducts.filter((product) => product.isFeatured).map((product, index) => (
                <motion.div
                  key={product.id}
                  role="button"
                  tabIndex={0}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => {
                    setSelectedProduct(product);
                    setSelectedProductImageIndex(0);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedProduct(product); setSelectedProductImageIndex(0); } }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full text-left rounded-2xl bg-white border border-slate-200/80 p-3 sm:p-4 shadow-sm hover:shadow hover:border-slate-300/80 transition-all flex gap-3 sm:gap-4 items-center group cursor-pointer"
                >
                  <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'flex';
                      }}
                    />
                    <div className="absolute inset-0 hidden items-center justify-center bg-slate-200">
                      <Ship size={24} className="text-slate-500" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{getProductTypeLabel(product.type)}</span>
                      {product.tag && (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">{product.tag}</span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">{product.name}</h3>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-base font-bold text-slate-900">{product.price.toFixed(2)}€</span>
                      {product.originalPrice > product.price && (
                        <span className="text-xs text-slate-500 line-through">{product.originalPrice.toFixed(2)}€</span>
                      )}
                      {product.discount > 0 && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">-{product.discount}%</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleShopFavorite(product); }}
                      className={`p-2 rounded-xl transition-colors ${
                        isShopFavorite(product.id) ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-600'
                      }`}
                    >
                      <Heart size={18} className={isShopFavorite(product.id) ? 'fill-current' : ''} strokeWidth={1.75} />
                    </button>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-500 tracking-widest uppercase">{t('shop.catalogueTitle')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t('shop.catalogueSubtitle')}</p>
            </div>
            <span className="shrink-0 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
              {shopLoading ? '…' : `${filteredShopProducts.length}`} produit{filteredShopProducts.length !== 1 ? 's' : ''}
            </span>
          </div>
          {shopLoading ? (
            <div className="flex items-center justify-center min-h-[280px] rounded-2xl bg-white border border-slate-200/80">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-slate-500" />
                <p className="text-xs text-slate-500">{t('common.loading')}</p>
              </div>
            </div>
          ) : filteredShopProducts.length === 0 ? (
            <div className="rounded-2xl bg-white border border-slate-200/80 px-4 py-12 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 mb-4">
                <ShoppingBag size={28} strokeWidth={1.5} />
              </div>
              <p className="text-slate-800 font-medium text-sm">{t('shop.catalogueEmpty') || 'Aucun produit'}</p>
              <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto">{t('shop.catalogueEmptyHint')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredShopProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.2) }}
                  whileTap={{ scale: 0.98 }}
                  className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow hover:border-slate-300/80 overflow-hidden transition-all duration-200"
                >
                  <button
                    onClick={() => { setSelectedProduct(product); setSelectedProductImageIndex(0); }}
                    className="w-full text-left block"
                  >
                    <div className="relative aspect-[3/4] sm:aspect-[4/3] bg-slate-100 overflow-hidden">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                      <div className="absolute inset-0 hidden items-center justify-center bg-slate-200">
                        <Ship size={32} className="text-slate-500" />
                      </div>
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        <span className="rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{getProductTypeLabel(product.type)}</span>
                        {product.tag && (
                          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">{product.tag}</span>
                        )}
                      </div>
                      <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                        {product.discount > 0 && (
                          <span className="rounded-md bg-red-500 text-white px-1.5 py-0.5 text-[10px] font-bold">-{product.discount}%</span>
                        )}
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${product.isAvailable ? 'bg-emerald-500/90 text-white' : 'bg-slate-600 text-white'}`}>
                          {product.isAvailable ? 'Dispo' : 'Rupture'}
                        </span>
                      </div>
                    </div>
                  </button>
                  <div className="p-3 sm:p-4 space-y-2.5">
                    <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug min-h-[2.5em]">
                      {product.name}
                    </h3>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-slate-900">{product.price.toFixed(2)}€</span>
                      {product.originalPrice > product.price && (
                        <span className="text-xs text-slate-500 line-through">{product.originalPrice.toFixed(2)}€</span>
                      )}
                    </div>
                    {product.features && product.features.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {product.features.slice(0, 2).map((feature, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 text-[10px] font-medium border border-slate-100">
                            {feature}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleShopFavorite(product); }}
                      className={`w-full py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                        isShopFavorite(product.id)
                          ? 'bg-rose-50 text-rose-600 border border-rose-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200/80 hover:bg-slate-200/80'
                      }`}
                    >
                      <Heart size={14} className={isShopFavorite(product.id) ? 'fill-current' : ''} strokeWidth={1.75} />
                      {isShopFavorite(product.id) ? t('shop.removeFromFavorites') : t('shop.addToFavorites')}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {shopFavorites.length > 0 && (
          <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 border border-rose-100">
                <Heart size={18} className="text-rose-500 fill-rose-500" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">{t('shop.myFavorites')}</h3>
                <p className="text-xs text-slate-500">{shopFavorites.length} produit{shopFavorites.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="p-3 space-y-2">
              {shopFavorites.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 rounded-xl bg-slate-50/80 border border-slate-100 p-3"
                >
                  <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                      }}
                    />
                    <div className="absolute inset-0 hidden items-center justify-center bg-slate-200">
                      <Heart size={16} className="text-slate-500 fill-slate-400" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 line-clamp-2">{item.name}</p>
                    <p className="text-sm font-bold text-slate-700 mt-0.5">{item.price.toFixed(2)}€</p>
                  </div>
                  <button
                    onClick={() => removeFromShopFavorites(item.id)}
                    className="p-2 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-50 transition-colors flex-shrink-0"
                    aria-label={t('common.removeFromFavorites')}
                  >
                    <Trash2 size={16} strokeWidth={1.75} />
                  </button>
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </div>

      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-detail-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-full w-full sm:max-w-lg max-h-[94vh] sm:max-h-[88vh] overflow-hidden shadow-xl border border-slate-200/80 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shop-product-detail-modal"
          >
            <div className="flex-shrink-0 flex justify-center pt-2 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-300" aria-hidden="true" />
            </div>
            <div className="relative flex-shrink-0">
              <div className="relative h-56 sm:h-64 bg-slate-100 min-h-[220px]">
                <img
                  src={selectedProduct.gallery && selectedProduct.gallery.length > 0
                    ? selectedProduct.gallery[selectedProductImageIndex]
                    : selectedProduct.image}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover object-center"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-center justify-center text-white font-bold text-4xl hidden">
                  🛍️
                </div>

                {selectedProduct.gallery && selectedProduct.gallery.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProductImageIndex(prev => prev === 0 ? selectedProduct.gallery.length - 1 : prev - 1);
                      }}
                      className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 p-2.5 sm:p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center bg-white/95 rounded-full text-slate-700 shadow-md hover:bg-white transition-colors"
                      aria-label={t('common.imagePrevious')}
                    >
                      <ChevronLeft size={20} className="sm:w-[18px] sm:h-[18px]" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProductImageIndex(prev => prev === selectedProduct.gallery.length - 1 ? 0 : prev + 1);
                      }}
                      className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 p-2.5 sm:p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center bg-white/95 rounded-full text-slate-700 shadow-md hover:bg-white transition-colors"
                      aria-label={t('common.imageNext')}
                    >
                      <ChevronRight size={20} className="sm:w-[18px] sm:h-[18px]" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                      {selectedProduct.gallery.map((_, index) => (
                        <button
                          key={`gallery-dot-${index}`}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedProductImageIndex(index); }}
                          className={`h-1.5 rounded-full transition-all flex-shrink-0 ${
                            index === selectedProductImageIndex ? 'bg-white w-6' : 'bg-white/60 w-1.5 hover:bg-white/80'
                          }`}
                          aria-label={t('common.imageIndex', { index: index + 1 })}
                        />
                      ))}
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={closeModal}
                  className="absolute top-3 right-3 p-2.5 sm:p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center bg-white/95 rounded-full text-slate-700 shadow-md hover:bg-white transition-colors"
                  aria-label={t('common.close')}
                >
                  <X size={20} className="sm:w-[18px] sm:h-[18px]" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-4 pt-6 sm:pt-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                  <h2 id="product-detail-title" className="text-lg sm:text-lg font-semibold text-white mb-1.5 line-clamp-2 leading-snug drop-shadow-sm">
                    {selectedProduct.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-white/95">
                    <span className="text-base sm:text-base font-bold">{selectedProduct.price.toFixed(2)}€</span>
                    {selectedProduct.originalPrice > selectedProduct.price && (
                      <span className="text-sm line-through opacity-90">{selectedProduct.originalPrice.toFixed(2)}€</span>
                    )}
                    {selectedProduct.discount > 0 && (
                      <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-1 rounded">-{selectedProduct.discount}%</span>
                    )}
                  </div>
                </div>
              </div>
              {selectedProduct.gallery && selectedProduct.gallery.length > 1 && (
                <div className="flex gap-2 p-3 sm:p-3 bg-slate-50 overflow-x-auto overflow-y-hidden scrollbar-hide -webkit-overflow-scrolling-touch">
                  {selectedProduct.gallery.map((img, index) => (
                    <button
                      key={`gallery-thumb-${index}`}
                      type="button"
                      onClick={() => setSelectedProductImageIndex(index)}
                      className={`shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden border-2 transition-all ${
                        index === selectedProductImageIndex ? 'border-slate-900 ring-2 ring-slate-300 ring-offset-1' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 sm:p-5 pb-8 sm:pb-5 overflow-y-auto flex-1 min-h-0 space-y-4 sm:space-y-5 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</h3>
                <p className="text-sm sm:text-sm text-slate-600 leading-relaxed">{selectedProduct.description}</p>
              </div>
              {selectedProduct.features && selectedProduct.features.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Caractéristiques</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProduct.features.map((feature, index) => (
                      <span key={index} className="px-2.5 py-1.5 sm:py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg border border-slate-200/80">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedProduct.specifications && Object.keys(selectedProduct.specifications).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Spécifications</h4>
                  <div className="space-y-1.5">
                    {Object.entries(selectedProduct.specifications).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm py-2 sm:py-1.5 border-b border-slate-100 last:border-0 gap-2">
                        <span className="text-slate-500 capitalize flex-shrink-0">{key}</span>
                        <span className="font-medium text-slate-800 text-right break-words">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-3 pt-2">
                <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">Prix</span>
                    <span className="text-xl sm:text-2xl font-bold text-slate-900">{selectedProduct.price.toFixed(2)}€</span>
                  </div>
                  {selectedProduct.originalPrice > selectedProduct.price && (
                    <p className="text-xs text-slate-500 line-through">{selectedProduct.originalPrice.toFixed(2)}€</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200/80">
                    <span className="flex items-center gap-1"><Ship size={12} /> Stock</span>
                    <span className="font-medium text-slate-700">{selectedProduct.stock} unités</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleShopFavorite(selectedProduct)}
                  className={`w-full py-3.5 sm:py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all min-h-[48px] ${
                    isShopFavorite(selectedProduct.id)
                      ? 'bg-rose-50 text-rose-600 border-2 border-rose-200 hover:bg-rose-100'
                      : 'bg-slate-900 text-white hover:bg-slate-800 border-2 border-slate-900'
                  }`}
                >
                  <Heart size={18} className={isShopFavorite(selectedProduct.id) ? 'fill-current' : ''} strokeWidth={1.75} />
                  {isShopFavorite(selectedProduct.id) ? t('shop.removeFromFavorites') : t('shop.addToFavorites')}
                </button>
                <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                  <Award size={12} /> Produit officiel GNV
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
