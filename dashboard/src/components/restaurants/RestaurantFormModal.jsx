import { motion } from 'framer-motion';
import RestaurantFormModalHeader from './RestaurantFormModalHeader';
import RestaurantFormModalBasicFields from './RestaurantFormModalBasicFields';
import RestaurantFormModalMenuSection from './RestaurantFormModalMenuSection';
import RestaurantFormModalPromotionsSection from './RestaurantFormModalPromotionsSection';
import RestaurantFormModalOpenStatus from './RestaurantFormModalOpenStatus';
import RestaurantFormModalFooter from './RestaurantFormModalFooter';

/**
 * Modal formulaire création / édition restaurant.
 */
export default function RestaurantFormModal({ onClose, onSave, editingId, t, boatConfig, form }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-restaurant-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        <RestaurantFormModalHeader editingId={editingId} t={t} onClose={onClose} />

        <div className="p-6 space-y-8 overflow-y-auto flex-1">
          <RestaurantFormModalBasicFields t={t} boatConfig={boatConfig} form={form} />
          <RestaurantFormModalMenuSection t={t} form={form} />
          <RestaurantFormModalPromotionsSection t={t} form={form} />
          <RestaurantFormModalOpenStatus t={t} form={form} />
        </div>

        <RestaurantFormModalFooter editingId={editingId} t={t} onClose={onClose} onSave={onSave} />
      </motion.div>
    </div>
  );
}
