import { Utensils, X } from 'lucide-react';

export default function RestaurantFormModalHeader({ editingId, t, onClose }) {
  return (
    <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50/50">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700">
          <Utensils size={24} />
        </div>
        <div>
          <h2 id="modal-restaurant-title" className="text-xl font-bold text-gray-900">
            {editingId ? t('restaurants.editRestaurant') : t('restaurants.newRestaurant')}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {editingId ? t('restaurants.modalSubtitleEdit') : t('restaurants.modalSubtitleNew')}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-2.5 hover:bg-white/80 rounded-xl transition-colors text-gray-500 hover:text-gray-700"
        aria-label={t('common.close')}
      >
        <X size={22} />
      </button>
    </div>
  );
}
