import { Award, Globe, Plus, X } from 'lucide-react';
import { LANG_LIST } from '../../utils/i18n';

export default function RestaurantFormModalPromotionsSection({ t, form }) {
  const { newRestaurant, activeLang, newPromotion, setNewPromotion, addPromotion, removePromotion } = form;

  return (
    <section className="border-t border-gray-200 pt-6">
      <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide flex items-center gap-2 mb-4">
        <Award size={16} className="text-orange-500" />
        {t('restaurants.promotionsLabel')}
      </h3>
      {(newRestaurant.promotions || []).length > 0 && (
        <div className="space-y-2 mb-4 max-h-44 overflow-y-auto pr-1">
          {newRestaurant.promotions.map((promo) => (
            <div
              key={promo.id}
              className="flex items-center justify-between p-3 bg-orange-50 rounded-xl gap-3 border border-orange-100"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {promo.translations?.[activeLang]?.title ?? promo.translations?.fr?.title ?? promo.title}
                </p>
                <p className="text-sm text-gray-600">
                  {promo.price}€{' '}
                  {promo.originalPrice != null && (
                    <span className="line-through text-gray-400">{promo.originalPrice}€</span>
                  )}
                  {promo.discount != null && (
                    <span className="ml-1 text-orange-600 font-medium">-{promo.discount}%</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removePromotion(promo.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                aria-label={t('restaurants.removePromotion')}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-4 p-4 bg-orange-50/50 rounded-xl border border-orange-100">
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Globe size={12} />
          {t('restaurants.contentByLanguage')} : titre et description de la promotion en{' '}
          <strong>{LANG_LIST.find((l) => l.code === activeLang)?.label ?? activeLang}</strong>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            value={newPromotion.translations?.[activeLang]?.title ?? ''}
            onChange={(e) =>
              setNewPromotion({
                ...newPromotion,
                translations: {
                  ...newPromotion.translations,
                  [activeLang]: { ...newPromotion.translations?.[activeLang], title: e.target.value },
                },
              })
            }
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder={t('restaurants.promotionTitlePlaceholder')}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            value={newPromotion.price}
            onChange={(e) => setNewPromotion({ ...newPromotion, price: e.target.value })}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder={t('restaurants.promotionPricePlaceholder')}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="number"
            step="0.01"
            min="0"
            value={newPromotion.originalPrice}
            onChange={(e) => setNewPromotion({ ...newPromotion, originalPrice: e.target.value })}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder={t('restaurants.originalPricePlaceholder')}
          />
          <input
            type="number"
            min="0"
            max="100"
            value={newPromotion.discount}
            onChange={(e) => setNewPromotion({ ...newPromotion, discount: e.target.value })}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder={t('restaurants.discountPlaceholder')}
          />
        </div>
        <input
          type="date"
          value={newPromotion.validUntil}
          onChange={(e) => setNewPromotion({ ...newPromotion, validUntil: e.target.value })}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          placeholder={t('restaurants.validUntilPlaceholder')}
        />
        <textarea
          value={newPromotion.translations?.[activeLang]?.description ?? ''}
          onChange={(e) =>
            setNewPromotion({
              ...newPromotion,
              translations: {
                ...newPromotion.translations,
                [activeLang]: { ...newPromotion.translations?.[activeLang], description: e.target.value },
              },
            })
          }
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          rows={2}
          placeholder={t('restaurants.promotionDescriptionPlaceholder')}
        />
        <button
          type="button"
          onClick={addPromotion}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <Plus size={16} />
          {t('restaurants.addPromotionButton')}
        </button>
      </div>
    </section>
  );
}
