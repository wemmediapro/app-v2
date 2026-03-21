export default function RestaurantFormModalOpenStatus({ t, form }) {
  const { newRestaurant, setNewRestaurant } = form;

  return (
    <section className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
      <input
        type="checkbox"
        id="isOpen"
        checked={newRestaurant.isOpen}
        onChange={(e) => setNewRestaurant({ ...newRestaurant, isOpen: e.target.checked })}
        className="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500"
      />
      <label htmlFor="isOpen" className="text-sm font-medium text-gray-700 cursor-pointer">
        {t('restaurants.restaurantOpenLabel')}
      </label>
    </section>
  );
}
