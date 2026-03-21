import { Clock, DollarSign, Globe, MapPin, Plus, Ship, Star, Upload, X } from 'lucide-react';
import { LANG_LIST } from '../../utils/i18n';
import { getFormLabel } from '../../constants/restaurantLabels';

export default function RestaurantFormModalBasicFields({ t, boatConfig, form }) {
  const {
    newRestaurant,
    setNewRestaurant,
    activeLang,
    setActiveLang,
    imageFile,
    imagePreview,
    handleImageUpload,
    removeImage,
    newSpecialty,
    setNewSpecialty,
    addSpecialty,
    removeSpecialty,
  } = form;

  return (
    <>
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide flex items-center gap-2">
          <Globe size={16} className="text-amber-600" />
          {t('restaurants.contentByLanguage')}
        </h3>
        <div className="flex flex-wrap gap-2">
          {LANG_LIST.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => setActiveLang(code)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeLang === code ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} ${code === 'fr' ? 'ring-1 ring-amber-200' : ''}`}
            >
              {label}
              {code === 'fr' && <span className="ml-1 text-xs opacity-80">*</span>}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 bg-gray-50/80 rounded-xl border border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('restaurants.restaurantName')} <span className="text-amber-600">*</span>
              <span className="text-gray-400 font-normal ml-1">({activeLang})</span>
            </label>
            <input
              type="text"
              value={newRestaurant.translations?.[activeLang]?.name ?? newRestaurant.name}
              onChange={(e) =>
                setNewRestaurant({
                  ...newRestaurant,
                  translations: {
                    ...newRestaurant.translations,
                    [activeLang]: { ...newRestaurant.translations?.[activeLang], name: e.target.value },
                  },
                })
              }
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder={t('restaurants.namePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('restaurants.description')} <span className="text-amber-600">*</span>
              <span className="text-gray-400 font-normal ml-1">({activeLang})</span>
            </label>
            <textarea
              value={newRestaurant.translations?.[activeLang]?.description ?? newRestaurant.description}
              onChange={(e) =>
                setNewRestaurant({
                  ...newRestaurant,
                  translations: {
                    ...newRestaurant.translations,
                    [activeLang]: { ...newRestaurant.translations?.[activeLang], description: e.target.value },
                  },
                })
              }
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
              rows={3}
              placeholder={t('restaurants.descriptionPlaceholder')}
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {getFormLabel(activeLang, 'restaurantTypeLabel')} <span className="text-amber-600">*</span>
            <span className="text-gray-400 font-normal ml-1">({activeLang})</span>
          </label>
          <input
            type="text"
            value={newRestaurant.translations?.[activeLang]?.type ?? newRestaurant.type ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setNewRestaurant({
                ...newRestaurant,
                ...(activeLang === 'fr' ? { type: v } : {}),
                translations: {
                  ...newRestaurant.translations,
                  [activeLang]: { ...newRestaurant.translations?.[activeLang], type: v },
                },
              });
            }}
            placeholder={getFormLabel(activeLang, 'selectPlaceholder')}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <p className="text-xs text-gray-500 mt-1">{t('restaurants.contentByLanguage')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {getFormLabel(activeLang, 'type')}
            <span className="text-gray-400 font-normal ml-1">({activeLang})</span>
          </label>
          <input
            type="text"
            value={newRestaurant.translations?.[activeLang]?.category ?? newRestaurant.category ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setNewRestaurant({
                ...newRestaurant,
                ...(activeLang === 'fr' ? { category: v } : {}),
                translations: {
                  ...newRestaurant.translations,
                  [activeLang]: { ...newRestaurant.translations?.[activeLang], category: v },
                },
              });
            }}
            placeholder={getFormLabel(activeLang, 'selectPlaceholder')}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <p className="text-xs text-gray-500 mt-1">{t('restaurants.contentByLanguage')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {getFormLabel(activeLang, 'shipLabel')} <span className="text-amber-600">*</span>
          </label>
          <div className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 flex items-center gap-2">
            <Ship size={18} className="text-slate-500 shrink-0" />
            {newRestaurant.shipName || boatConfig.shipName || getFormLabel(activeLang, 'selectShipPlaceholder')}
          </div>
          <p className="text-xs text-gray-500 mt-1">{t('settings.boatConfigSubtitle')}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
            <MapPin size={14} /> {getFormLabel(activeLang, 'locationLabel')}
          </label>
          <input
            type="text"
            value={newRestaurant.location}
            onChange={(e) => setNewRestaurant({ ...newRestaurant, location: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder={getFormLabel(activeLang, 'locationPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
            <DollarSign size={14} /> {getFormLabel(activeLang, 'priceRangeLabel')}
          </label>
          <select
            value={newRestaurant.priceRange}
            onChange={(e) => setNewRestaurant({ ...newRestaurant, priceRange: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="€">{getFormLabel(activeLang, 'priceRangeBudget')}</option>
            <option value="€€">{getFormLabel(activeLang, 'priceRangeModerate')}</option>
            <option value="€€€">{getFormLabel(activeLang, 'priceRangeHigh')}</option>
            <option value="€€€€">{getFormLabel(activeLang, 'priceRangeVeryHigh')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
            <Clock size={14} /> {getFormLabel(activeLang, 'openingHoursLabel')}
          </label>
          <input
            type="text"
            value={newRestaurant.openingHours}
            onChange={(e) => setNewRestaurant({ ...newRestaurant, openingHours: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder={getFormLabel(activeLang, 'openingHoursPlaceholder')}
          />
        </div>
      </section>

      <section>
        <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
          <Star size={14} className="text-amber-500" /> {t('restaurants.displayedRating')}
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            max="5"
            step="0.5"
            value={newRestaurant.rating}
            onChange={(e) => setNewRestaurant({ ...newRestaurant, rating: parseFloat(e.target.value) || 4.5 })}
            className="w-24 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-gray-500 text-sm">/ 5</span>
        </div>
      </section>

      <section>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('restaurants.restaurantImage')}</label>
        {imagePreview ? (
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
            <div className="flex items-center gap-4">
              <div className="w-36 h-24 rounded-lg overflow-hidden bg-white border border-gray-200 shadow-sm">
                <img src={imagePreview} alt="Aperçu" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {imageFile?.name || t('restaurants.imageSelected')}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {imageFile ? `${(imageFile.size / 1024).toFixed(1)} KB` : t('restaurants.imageExisting')}
                </p>
              </div>
              <button
                type="button"
                onClick={removeImage}
                className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-amber-50 hover:border-amber-300 transition-colors">
            <div className="flex flex-col items-center justify-center py-6">
              <Upload size={36} className="text-gray-400 mb-2" />
              <p className="mb-1 text-sm font-medium text-gray-600">{t('restaurants.clickOrDrag')}</p>
              <p className="text-xs text-gray-500">{t('restaurants.imageSpecs')}</p>
            </div>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
        )}
      </section>

      <section>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('restaurants.specialtiesLabel')}</label>
        <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
          <Globe size={12} />
          {t('restaurants.contentByLanguage')} : spécialités en{' '}
          <strong>{LANG_LIST.find((l) => l.code === activeLang)?.label ?? activeLang}</strong>
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {(newRestaurant.translations?.[activeLang]?.specialties ?? newRestaurant.specialties ?? []).map(
            (specialty, index) => (
              <span
                key={`${activeLang}-${index}-${specialty}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-sm font-medium"
              >
                {specialty}
                <button
                  type="button"
                  onClick={() => removeSpecialty(specialty)}
                  className="hover:text-amber-900 p-0.5 rounded"
                  aria-label={t('restaurants.removeSpecialty', { name: specialty })}
                >
                  <X size={14} />
                </button>
              </span>
            )
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newSpecialty}
            onChange={(e) => setNewSpecialty(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSpecialty();
              }
            }}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder={t('restaurants.specialtiesPlaceholder')}
          />
          <button
            type="button"
            onClick={addSpecialty}
            className="px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-1"
          >
            <Plus size={18} />
            {t('common.add')}
          </button>
        </div>
      </section>
    </>
  );
}
