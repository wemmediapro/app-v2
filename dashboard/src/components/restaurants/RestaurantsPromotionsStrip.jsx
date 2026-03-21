import { Award } from 'lucide-react';

/**
 * Bandeau récap des promotions sur tous les restaurants (lien édition rapide).
 */
export default function RestaurantsPromotionsStrip({ restaurants, restaurantsLoading, t, onEditRestaurant }) {
  if (restaurantsLoading || restaurants.length === 0) return null;

  const allPromotions = restaurants.flatMap((r) =>
    (Array.isArray(r.promotions) ? r.promotions : []).map((promo) => ({
      ...promo,
      restaurantId: r._id,
      restaurantName: r.name,
      restaurant: r,
    }))
  );

  if (allPromotions.length > 0) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
            <Award size={18} className="text-amber-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">{t('shop.promotions')}</h2>
            <p className="text-xs text-slate-500">
              {t('restaurants.promotionsCount', { count: allPromotions.length })}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {allPromotions.map((promo) => (
            <div
              key={`${promo.restaurantId}-${promo.id ?? promo.title}`}
              className="flex items-center justify-between p-3 rounded-xl bg-amber-50/80 border border-amber-100 gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-amber-700 uppercase tracking-wide">{promo.restaurantName}</p>
                <p className="font-medium text-slate-800 truncate text-sm mt-0.5">{promo.title}</p>
                <p className="text-xs text-slate-600 mt-1">
                  <span className="font-semibold text-amber-600">{promo.price}€</span>
                  {promo.originalPrice != null && (
                    <span className="ml-1 line-through text-slate-400">{promo.originalPrice}€</span>
                  )}
                  {promo.discount != null && <span className="ml-1 text-amber-600">-{promo.discount}%</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onEditRestaurant(promo.restaurant)}
                className="shrink-0 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
              >
                {t('common.edit')}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200">
          <Award size={18} className="text-slate-500" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{t('shop.promotions')}</h2>
          <p className="text-xs text-slate-500">{t('restaurants.noPromotionsHint')}</p>
        </div>
      </div>
    </div>
  );
}
