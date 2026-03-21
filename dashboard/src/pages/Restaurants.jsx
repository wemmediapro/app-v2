import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { apiService } from '../services/apiService';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useBoatConfig } from '../contexts/BoatConfigContext';
import { useRestaurantsList } from '../hooks/useRestaurantsList';
import { useRestaurantForm } from '../hooks/useRestaurantForm';
import RestaurantsPromotionsStrip from '../components/restaurants/RestaurantsPromotionsStrip';
import RestaurantAdminCard from '../components/restaurants/RestaurantAdminCard';
import { RestaurantsListLoading, RestaurantsListEmpty } from '../components/restaurants/RestaurantsListPlaceholders';
import RestaurantFormModal from '../components/restaurants/RestaurantFormModal';

const Restaurants = () => {
  const { t } = useLanguage();
  const { boatConfig } = useBoatConfig();
  const { restaurants, setRestaurants, loading: restaurantsLoading } = useRestaurantsList();
  const [actionMenuOpen, setActionMenuOpen] = useState(null);

  const { showAddModal, editingId, closeModal, openNewRestaurantModal, openEditRestaurantModal, saveRestaurant, form } =
    useRestaurantForm({ boatConfig, restaurants, setRestaurants });

  const openEditModal = (r) => {
    setActionMenuOpen(null);
    openEditRestaurantModal(r);
  };

  const handleDeleteRestaurant = async (r) => {
    setActionMenuOpen(null);
    if (!window.confirm(t('restaurants.confirmDeleteRestaurant', { name: r.name }))) return;
    try {
      await apiService.deleteRestaurant(r._id);
      setRestaurants((prev) => prev.filter((x) => x._id !== r._id));
      toast.success('Restaurant supprimé');
    } catch (error) {
      console.error('Erreur suppression restaurant:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const handleDuplicateRestaurant = async (r) => {
    setActionMenuOpen(null);
    try {
      const res = await apiService.getRestaurant(r._id);
      const data = res.data ?? res;
      const copy = { ...data };
      delete copy._id;
      delete copy.__v;
      copy.name = (copy.name || '') + ' (copie)';
      if (copy.translations?.fr) {
        copy.translations = { ...copy.translations };
        copy.translations.fr = { ...copy.translations.fr, name: (copy.translations.fr.name || copy.name) + ' (copie)' };
      }
      const createRes = await apiService.createRestaurant(copy);
      const created = createRes.data?.restaurant ?? { ...copy, _id: createRes.data?._id };
      setRestaurants((prev) => [...prev, created]);
      toast.success('Restaurant dupliqué');
    } catch (error) {
      console.error('Erreur duplication restaurant:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la duplication');
    }
  };

  return (
    <div className="space-y-6 pb-8 w-full">
      {/* En-tête compact */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">{t('restaurants.title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {restaurantsLoading
              ? t('common.loading')
              : t('restaurants.restaurantsCount', { count: restaurants.length })}
          </p>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={openNewRestaurantModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors shrink-0"
        >
          <Plus size={18} />
          {t('restaurants.addRestaurant')}
        </motion.button>
      </div>

      <RestaurantsPromotionsStrip
        restaurants={restaurants}
        restaurantsLoading={restaurantsLoading}
        t={t}
        onEditRestaurant={openEditModal}
      />

      {restaurantsLoading ? (
        <RestaurantsListLoading />
      ) : restaurants.length === 0 ? (
        <RestaurantsListEmpty t={t} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {restaurants.map((r) => (
            <RestaurantAdminCard
              key={r._id || r.id}
              restaurant={r}
              t={t}
              actionMenuOpen={actionMenuOpen}
              setActionMenuOpen={setActionMenuOpen}
              onEdit={openEditModal}
              onDuplicate={handleDuplicateRestaurant}
              onDelete={handleDeleteRestaurant}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <RestaurantFormModal
          onClose={closeModal}
          onSave={saveRestaurant}
          editingId={editingId}
          t={t}
          boatConfig={boatConfig}
          form={form}
        />
      )}
    </div>
  );
};

export default Restaurants;
