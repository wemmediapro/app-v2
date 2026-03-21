import { Utensils } from 'lucide-react';

export function RestaurantsListLoading() {
  return (
    <div className="flex items-center justify-center min-h-[280px] rounded-xl bg-white border border-slate-200/80">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-500 border-t-transparent" />
        <p className="text-sm text-slate-500">Chargement...</p>
      </div>
    </div>
  );
}

export function RestaurantsListEmpty({ t }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
      <div className="rounded-2xl bg-slate-100 p-6 inline-flex mb-4">
        <Utensils size={40} className="text-slate-400" />
      </div>
      <p className="text-slate-600 font-medium">{t('restaurants.noRestaurants')}</p>
      <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">{t('restaurants.noRestaurantsHint')}</p>
    </div>
  );
}
