import { motion } from 'framer-motion';
import { Save } from 'lucide-react';

export default function RestaurantFormModalFooter({ editingId, t, onClose, onSave }) {
  return (
    <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50/50">
      <button
        type="button"
        onClick={onClose}
        className="px-5 py-2.5 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors font-medium"
      >
        {t('common.cancel')}
      </button>
      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onSave}
        className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium shadow-sm"
      >
        <Save size={18} />
        {editingId ? t('restaurants.saveChanges') : t('restaurants.saveRestaurant')}
      </motion.button>
    </div>
  );
}
