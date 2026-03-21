import { motion } from 'framer-motion';
import { Star, MapPin, MoreVertical, Pencil, Copy, Trash2 } from 'lucide-react';
import { DEFAULT_RESTAURANT_IMAGE, getRestaurantImageSrc } from '../../utils/restaurantImages';

export default function RestaurantAdminCard({
  restaurant: r,
  t,
  actionMenuOpen,
  setActionMenuOpen,
  onEdit,
  onDuplicate,
  onDelete,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="group bg-white rounded-xl border border-slate-200/80 overflow-hidden hover:border-slate-300 hover:shadow-md transition-all duration-200"
    >
      <div className="aspect-video bg-slate-100 relative">
        <img
          src={getRestaurantImageSrc(r)}
          alt={r.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.src = DEFAULT_RESTAURANT_IMAGE;
            e.target.onerror = null;
          }}
        />
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/95 backdrop-blur px-2 py-1 rounded-full shadow-sm">
          <Star size={12} className="text-amber-500 fill-amber-500" />
          <span className="text-xs font-semibold text-slate-700">{r.rating ?? '-'}</span>
        </div>
        <div className="absolute top-2 left-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setActionMenuOpen(actionMenuOpen === r._id ? null : r._id)}
              className="p-1.5 rounded-lg bg-white/95 backdrop-blur shadow-sm text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
              aria-label={t('common.actions')}
            >
              <MoreVertical size={18} />
            </button>
            {actionMenuOpen === r._id && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setActionMenuOpen(null)} aria-hidden="true" />
                <div className="absolute left-0 top-full mt-1 py-1 min-w-[160px] bg-white rounded-xl border border-slate-200 shadow-lg z-20">
                  <button
                    type="button"
                    onClick={() => onEdit(r)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-amber-50 hover:text-amber-800 transition-colors text-sm"
                  >
                    <Pencil size={14} />
                    {t('common.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicate(r)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-amber-50 hover:text-amber-800 transition-colors text-sm"
                  >
                    <Copy size={14} />
                    {t('common.duplicate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(r)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50 transition-colors text-sm"
                  >
                    <Trash2 size={14} />
                    {t('common.delete')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        <h3 className="font-medium text-slate-800 truncate text-base">{r.name}</h3>
        <p className="text-xs text-slate-500">{r.type}</p>
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <MapPin size={11} />
          <span>{r.location || '—'}</span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-xs font-medium text-amber-600">{r.priceRange}</span>
          <span className="text-[11px] text-slate-400">
            {r.menu?.length ?? 0} {t('restaurants.dishes')}
            {(r.promotions?.length ?? 0) > 0 && (
              <span className="ml-1 text-amber-600">
                · {r.promotions.length} {t('restaurants.promos')}
              </span>
            )}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
