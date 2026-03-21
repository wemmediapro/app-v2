import { Globe, Pencil, Plus, Upload, Utensils, X } from 'lucide-react';
import { LANG_LIST } from '../../utils/i18n';
import { MENU_CATEGORY_LABELS } from '../../constants/restaurantLabels';
import { getImageSrc } from '../../utils/restaurantImages';

export default function RestaurantFormModalMenuSection({ t, form }) {
  const {
    newRestaurant,
    activeLang,
    newMenuItem,
    setNewMenuItem,
    menuItemImagePreview,
    handleMenuItemImageUpload,
    removeMenuItemImage,
    uploadingMenuItemImage,
    editingMenuItemId,
    addMenuItem,
    openEditMenuItem,
    cancelEditMenuItem,
    removeMenuItem,
  } = form;

  return (
    <section className="border-t border-gray-200 pt-6">
      <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide flex items-center gap-2 mb-4">
        <Utensils size={16} className="text-amber-600" />
        {t('restaurants.menu')}
      </h3>
      {newRestaurant.menu.length > 0 && (
        <div className="space-y-2 mb-4 max-h-52 overflow-y-auto pr-1">
          {newRestaurant.menu.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl gap-3 border border-gray-100"
            >
              <div className="relative w-12 h-12 flex-shrink-0">
                {item.image ? (
                  <img
                    src={getImageSrc(item.image)}
                    alt={item.name}
                    className="w-12 h-12 object-cover rounded-lg absolute inset-0"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const placeholder = e.target.nextElementSibling;
                      if (placeholder) placeholder.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center"
                  style={{ display: item.image ? 'none' : 'flex' }}
                >
                  <Utensils size={20} className="text-amber-600" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {item.translations?.[activeLang]?.name || item.translations?.fr?.name || item.name}
                </p>
                <p className="text-sm text-gray-500">
                  €{item.price}
                  {item.category ? ` · ${MENU_CATEGORY_LABELS[item.category]?.[activeLang] || item.category}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => openEditMenuItem(item)}
                  className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                  aria-label={t('restaurants.editMenuItem')}
                  title={t('restaurants.editMenuItem')}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => removeMenuItem(item.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  aria-label={t('restaurants.removeFromMenu')}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Globe size={12} />
          {t('restaurants.contentByLanguage')} : nom et description du plat en{' '}
          <strong>{LANG_LIST.find((l) => l.code === activeLang)?.label ?? activeLang}</strong>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            value={newMenuItem.translations?.[activeLang]?.name ?? ''}
            onChange={(e) =>
              setNewMenuItem({
                ...newMenuItem,
                translations: {
                  ...newMenuItem.translations,
                  [activeLang]: { ...newMenuItem.translations?.[activeLang], name: e.target.value },
                },
              })
            }
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder={t('restaurants.dishNamePlaceholder')}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            value={newMenuItem.price}
            onChange={(e) => setNewMenuItem({ ...newMenuItem, price: e.target.value })}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder={t('restaurants.pricePlaceholder')}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            value={newMenuItem.category}
            onChange={(e) => setNewMenuItem({ ...newMenuItem, category: e.target.value })}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {Object.entries(MENU_CATEGORY_LABELS).map(([key]) => (
              <option key={key} value={key}>
                {MENU_CATEGORY_LABELS[key][activeLang] || key}
              </option>
            ))}
          </select>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {t('restaurants.dishImageOptional')}
            </label>
            {menuItemImagePreview ? (
              <div className="flex items-center gap-2">
                <img
                  src={getImageSrc(menuItemImagePreview) || menuItemImagePreview}
                  alt="Aperçu"
                  className="w-14 h-14 object-cover rounded-lg border border-gray-300"
                />
                <button
                  type="button"
                  onClick={removeMenuItemImage}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 w-full h-11 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-amber-50 hover:border-amber-300 justify-center transition-colors">
                <Upload size={18} className="text-gray-500" />
                <span className="text-xs text-gray-600">{t('restaurants.addImage')}</span>
                <input type="file" accept="image/*" onChange={handleMenuItemImageUpload} className="hidden" />
              </label>
            )}
          </div>
        </div>
        <textarea
          value={newMenuItem.translations?.[activeLang]?.description ?? ''}
          onChange={(e) =>
            setNewMenuItem({
              ...newMenuItem,
              translations: {
                ...newMenuItem.translations,
                [activeLang]: { ...newMenuItem.translations?.[activeLang], description: e.target.value },
              },
            })
          }
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          rows={2}
          placeholder={t('restaurants.dishDescriptionPlaceholder')}
        />
        <div className="flex items-center justify-between flex-wrap gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newMenuItem.isPopular}
              onChange={(e) => setNewMenuItem({ ...newMenuItem, isPopular: e.target.checked })}
              className="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500"
            />
            <span className="text-sm text-gray-700">{t('restaurants.popularDish')}</span>
          </label>
          <div className="flex items-center gap-2">
            {editingMenuItemId && (
              <button
                type="button"
                onClick={cancelEditMenuItem}
                className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
              >
                {t('common.cancel')}
              </button>
            )}
            <button
              type="button"
              onClick={addMenuItem}
              disabled={uploadingMenuItemImage}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editingMenuItemId ? (
                <>
                  <Pencil size={16} />
                  {t('restaurants.editMenuItem')}
                </>
              ) : (
                <>
                  <Plus size={16} />
                  {uploadingMenuItemImage ? t('shipmap.uploading') : t('restaurants.addToMenu')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
