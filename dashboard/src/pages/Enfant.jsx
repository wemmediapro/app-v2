import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Baby, Plus, Edit, Trash2, Search, Clock, Users, MapPin, Calendar, X, Save, Upload, Globe } from 'lucide-react';
import { apiService } from '../services/apiService';
import { LANG_LIST, emptyTranslations } from '../utils/i18n';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';

const Enfant = () => {
  const { t, language } = useLanguage();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [_countryFilter, _setCountryFilter] = useState('all');
  const [_destinationFilter, _setDestinationFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [activeLang, setActiveLang] = useState('fr');
  const [newActivity, setNewActivity] = useState({
    name: '',
    category: '',
    description: '',
    ageRange: '',
    duration: '',
    location: '',
    capacity: '',
    price: 0,
    schedule: '',
    instructor: '',
    features: [],
    isActive: true,
    countries: [],
    translations: emptyTranslations(),
  });
  const [newFeature, setNewFeature] = useState('');

  // Pays disponibles
  const availableCountries = [
    { name: 'Maroc', code: 'MA' },
    { name: 'Tunisie', code: 'TN' },
    { name: 'Algérie', code: 'DZ' },
    { name: 'Italie', code: 'IT' },
    { name: 'Espagne', code: 'ES' },
  ];

  // Catégories disponibles
  const availableCategories = [
    'Jeux',
    'Arts & Créativité',
    'Sport',
    'Éducation',
    'Divertissement',
    'Musique',
    'Danse',
    'Lecture',
  ];

  useEffect(() => {
    fetchActivities();
  }, [language]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await apiService.getEnfantActivities(`lang=${language}`);
      setActivities(response.data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast.error(t('common.errorLoad'));
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set(activities.map((activity) => activity.category));
    return Array.from(cats).sort();
  }, [activities]);

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      const matchesSearch =
        activity.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || activity.category === categoryFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && activity.isActive) ||
        (statusFilter === 'inactive' && !activity.isActive);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [activities, searchQuery, categoryFilter, statusFilter]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error(t('enfant.selectImageFile'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('enfant.fileTooBig'));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setImageFile(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const addFeature = () => {
    if (newFeature.trim() && !newActivity.features.includes(newFeature.trim())) {
      setNewActivity({
        ...newActivity,
        features: [...newActivity.features, newFeature.trim()],
      });
      setNewFeature('');
    }
  };

  const removeFeature = (feature) => {
    setNewActivity({
      ...newActivity,
      features: newActivity.features.filter((f) => f !== feature),
    });
  };

  const toggleCountry = (countryName) => {
    setNewActivity({
      ...newActivity,
      countries: newActivity.countries.includes(countryName)
        ? newActivity.countries.filter((c) => c !== countryName)
        : [...newActivity.countries, countryName],
    });
  };

  const openEditModal = (activity) => {
    const durationStr = activity.duration || '60 min';
    const durationNum = durationStr.match(/^(\d+)/)?.[1] ?? 60;
    setEditingActivity(activity);
    setNewActivity({
      name: activity.name || '',
      category: activity.category || '',
      description: activity.description || '',
      ageRange: activity.ageRange || '',
      duration: durationNum,
      location: activity.location || '',
      capacity: activity.capacity || '',
      price: activity.price ?? 0,
      schedule: activity.schedule || '',
      instructor: activity.instructor || '',
      features: Array.isArray(activity.features) ? [...activity.features] : [],
      isActive: activity.isActive !== false,
      countries: Array.isArray(activity.countries) ? [...activity.countries] : [],
      translations:
        activity.translations && typeof activity.translations === 'object'
          ? { ...emptyTranslations(), ...activity.translations }
          : emptyTranslations(),
    });
    setImagePreview(activity.image || activity.imageUrl || null);
    setImageFile(null);
    setNewFeature('');
    setActiveLang('fr');
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingActivity(null);
    setImageFile(null);
    setImagePreview(null);
    setNewFeature('');
    setActiveLang('fr');
    setNewActivity({
      name: '',
      category: '',
      description: '',
      ageRange: '',
      duration: '',
      location: '',
      capacity: '',
      price: 0,
      schedule: '',
      instructor: '',
      features: [],
      isActive: true,
      countries: [],
      translations: emptyTranslations(),
    });
  };

  const handleUpdateActivity = async () => {
    if (!editingActivity?._id) return;
    const frName = (newActivity.translations?.fr?.name ?? newActivity.name)?.trim();
    const frDesc = (newActivity.translations?.fr?.description ?? newActivity.description)?.trim() ?? '';
    if (!frName || !newActivity.category || !frDesc) {
      toast.error(t('enfant.fillRequired'));
      return;
    }
    if (newActivity.countries.length === 0) {
      toast.error(t('enfant.selectOneCountry'));
      return;
    }
    try {
      const translations = { fr: { name: frName, description: frDesc } };
      LANG_LIST.forEach(({ code }) => {
        if (code === 'fr') return;
        const tr = newActivity.translations?.[code];
        if (tr && (tr.name || tr.description)) {
          translations[code] = { name: tr.name || '', description: tr.description || '' };
        }
      });
      const activityData = {
        ...newActivity,
        name: frName,
        description: frDesc,
        translations,
        imageUrl: imagePreview || editingActivity.imageUrl || editingActivity.image,
        capacity: String(newActivity.capacity || 15),
        price: parseFloat(newActivity.price) || 0,
        duration:
          typeof newActivity.duration === 'number'
            ? `${newActivity.duration} min`
            : newActivity.duration
              ? `${newActivity.duration} min`
              : '60 min',
        schedule: newActivity.schedule || '10h-11h',
        location: newActivity.location || 'Espace Enfant - Pont 6',
        ageRange: newActivity.ageRange || '4-12 ans',
      };
      await apiService.updateEnfantActivity(editingActivity._id, activityData);
      closeModal();
      toast.success(t('enfant.activityUpdated'));
      fetchActivities();
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
      toast.error(t('enfant.updateError'));
    }
  };

  const handleDeleteActivity = async (activity) => {
    if (!window.confirm(t('enfant.confirmDelete', { name: activity.name }))) return;
    try {
      await apiService.deleteEnfantActivity(activity._id);
      toast.success(t('enfant.activityDeleted'));
      fetchActivities();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error(t('enfant.deleteError'));
    }
  };

  const handleAddActivity = async () => {
    const frName = (newActivity.translations?.fr?.name ?? newActivity.name)?.trim();
    const frDesc = (newActivity.translations?.fr?.description ?? newActivity.description)?.trim() ?? '';
    if (!frName || !newActivity.category || !frDesc) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (newActivity.countries.length === 0) {
      toast.error('Veuillez sélectionner au moins un pays');
      return;
    }

    try {
      const translations = { fr: { name: frName, description: frDesc } };
      LANG_LIST.forEach(({ code }) => {
        if (code === 'fr') return;
        const t = newActivity.translations?.[code];
        if (t && (t.name || t.description)) {
          translations[code] = { name: t.name || '', description: t.description || '' };
        }
      });
      const activityData = {
        ...newActivity,
        name: frName,
        description: frDesc,
        translations,
        imageUrl:
          imagePreview ||
          newActivity.imageUrl ||
          'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&h=400&fit=crop',
        capacity: String(newActivity.capacity || 15),
        price: parseFloat(newActivity.price) || 0,
        duration:
          typeof newActivity.duration === 'number' ? `${newActivity.duration} min` : newActivity.duration || '60 min',
        schedule: newActivity.schedule || '10h-11h',
        location: newActivity.location || 'Espace Enfant - Pont 6',
        ageRange: newActivity.ageRange || '4-12 ans',
      };

      await apiService.createEnfantActivity(activityData);
      closeModal();
      toast.success(t('enfant.activityAdded'));
      fetchActivities();
    } catch (error) {
      console.error("Erreur lors de l'ajout de l'activité:", error);
      toast.error(t('enfant.addError'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  const activeActivities = activities.filter((a) => a.isActive);

  const totalParticipants = activities.reduce((sum, a) => sum + (a.currentParticipants || 0), 0);
  const totalActivities = activities.length;

  return (
    <div className="space-y-6 pb-8 w-full">
      {/* En-tête compact */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">{t('enfant.title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('enfant.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setEditingActivity(null);
              setImageFile(null);
              setImagePreview(null);
              setNewFeature('');
              setActiveLang('fr');
              setNewActivity({
                name: '',
                category: '',
                description: '',
                ageRange: '',
                duration: '',
                location: '',
                capacity: '',
                price: 0,
                schedule: '',
                instructor: '',
                features: [],
                isActive: true,
                countries: [],
                translations: emptyTranslations(),
              });
              setShowAddModal(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors shrink-0"
          >
            <Plus size={18} />
            {t('enfant.addActivity')}
          </motion.button>
        </div>
      </div>

      {/* Stats compactes */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-50">
            <Baby size={18} className="text-pink-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">{t('enfant.totalActivities')}</p>
            <p className="text-lg font-semibold text-slate-800 tabular-nums">{totalActivities}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
            <Baby size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">{t('enfant.active')}</p>
            <p className="text-lg font-semibold text-slate-800 tabular-nums">{activeActivities.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
            <Users size={18} className="text-violet-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">{t('enfant.participants')}</p>
            <p className="text-lg font-semibold text-slate-800 tabular-nums">{totalParticipants}</p>
          </div>
        </div>
      </div>

      {/* Recherche + filtres */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t('enfant.searchActivity')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-colors"
          />
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-slate-50/80 p-1 gap-0.5 shrink-0">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3.5 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">{t('enfant.allCategories')}</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">{t('enfant.allStatuses')}</option>
            <option value="active">{t('enfant.statusActive')}</option>
            <option value="inactive">{t('enfant.statusInactive')}</option>
          </select>
        </div>
      </div>

      {/* Activities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredActivities.map((activity) => {
          const occupancyRate =
            activity.capacity > 0 ? Math.round((activity.currentParticipants / activity.capacity) * 100) : 0;
          const isFull = activity.currentParticipants >= activity.capacity;

          return (
            <motion.div
              key={activity._id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-slate-200/80 overflow-hidden hover:border-slate-300 hover:shadow-md transition-all duration-200"
            >
              <div className="aspect-video bg-gradient-to-br from-pink-100 to-purple-100 relative overflow-hidden">
                {activity.image ? (
                  <img
                    src={activity.image}
                    alt={activity.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`absolute inset-0 ${activity.image ? 'hidden' : 'flex'} items-center justify-center`}>
                  <Baby size={48} className="text-pink-500" />
                </div>
                {!activity.isActive && (
                  <div className="absolute top-2 right-2 bg-gray-500 text-white px-2 py-1 rounded-full text-xs font-semibold z-10">
                    {t('enfant.inactive')}
                  </div>
                )}
                {isFull && activity.isActive && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold z-10">
                    {t('enfant.full')}
                  </div>
                )}
                {activity.price > 0 && (
                  <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-semibold z-10">
                    {activity.price}€
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs px-2 py-1 rounded bg-pink-100 text-pink-700 font-medium">
                    {activity.category}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Users size={14} />
                    <span>
                      {activity.currentParticipants || 0}/{activity.capacity || 0}
                    </span>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">{activity.name}</h3>
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{activity.description}</p>
                {activity.countries && activity.countries.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {activity.countries.slice(0, 3).map((country, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded flex items-center gap-1"
                      >
                        <Globe size={10} />
                        {country}
                      </span>
                    ))}
                    {activity.countries.length > 3 && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                        +{activity.countries.length - 3}
                      </span>
                    )}
                  </div>
                )}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock size={14} />
                    <span>{activity.duration} min</span>
                    <span className="mx-1">•</span>
                    <span>{activity.ageRange}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <MapPin size={14} />
                    <span className="line-clamp-1">{activity.location}</span>
                  </div>
                  {activity.schedule && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar size={14} />
                      <span>{activity.schedule}</span>
                    </div>
                  )}
                  {activity.instructor && (
                    <div className="text-xs text-gray-500">
                      {t('enfant.instructorLabel')}: {activity.instructor}
                    </div>
                  )}
                </div>
                {activity.capacity > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>{t('enfant.occupancy')}</span>
                      <span>{occupancyRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          occupancyRate >= 90 ? 'bg-red-500' : occupancyRate >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => openEditModal(activity)}
                    className="flex-1 flex items-center justify-center gap-2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit size={16} />
                    <span className="text-xs">{t('common.edit')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteActivity(activity)}
                    className="flex-1 flex items-center justify-center gap-2 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                    <span className="text-xs">{t('common.delete')}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
        {filteredActivities.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl bg-slate-100 p-6 mb-4">
              <Baby size={40} className="text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">{t('enfant.noActivityFound')}</p>
          </div>
        )}
      </div>

      {/* Modal Ajouter Activité */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingActivity ? t('enfant.editActivity') : t('enfant.addActivity')}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('enfant.contentByLanguage')}</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {LANG_LIST.map(({ code, label }) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setActiveLang(code)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeLang === code ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('enfant.activityNameRequired')}
                    </label>
                    <input
                      type="text"
                      value={
                        activeLang === 'fr' ? newActivity.name : (newActivity.translations?.[activeLang]?.name ?? '')
                      }
                      onChange={(e) =>
                        activeLang === 'fr'
                          ? setNewActivity({ ...newActivity, name: e.target.value })
                          : setNewActivity({
                              ...newActivity,
                              translations: {
                                ...newActivity.translations,
                                [activeLang]: { ...newActivity.translations?.[activeLang], name: e.target.value },
                              },
                            })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t('enfant.placeholderActivityName')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('enfant.descriptionRequired')}
                    </label>
                    <textarea
                      value={
                        activeLang === 'fr'
                          ? newActivity.description
                          : (newActivity.translations?.[activeLang]?.description ?? '')
                      }
                      onChange={(e) =>
                        activeLang === 'fr'
                          ? setNewActivity({ ...newActivity, description: e.target.value })
                          : setNewActivity({
                              ...newActivity,
                              translations: {
                                ...newActivity.translations,
                                [activeLang]: {
                                  ...newActivity.translations?.[activeLang],
                                  description: e.target.value,
                                },
                              },
                            })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder={t('enfant.placeholderDescription')}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('enfant.categoryRequired')}</label>
                <select
                  value={newActivity.category}
                  onChange={(e) => setNewActivity({ ...newActivity, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('enfant.selectCategory')}</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pays */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">{t('enfant.assignCountries')}</label>
                <div className="border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                  {availableCountries.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">{t('enfant.noCountryAvailable')}</p>
                  ) : (
                    <div className="space-y-2">
                      {availableCountries.map((country) => (
                        <label
                          key={country.code}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={newActivity.countries.includes(country.name)}
                            onChange={() => toggleCountry(country.name)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1 flex items-center gap-2">
                            <span className="font-medium text-gray-900">{country.name}</span>
                            <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded">
                              {country.code}
                            </span>
                          </div>
                          {newActivity.countries.includes(country.name) && (
                            <Globe size={16} className="text-blue-600" />
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {newActivity.countries.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {t('enfant.countriesSelected', { count: newActivity.countries.length })}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('enfant.ageRange')}</label>
                  <input
                    type="text"
                    value={newActivity.ageRange}
                    onChange={(e) => setNewActivity({ ...newActivity, ageRange: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('enfant.placeholderAgeRange')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('enfant.durationMin')}</label>
                  <input
                    type="number"
                    value={newActivity.duration}
                    onChange={(e) => setNewActivity({ ...newActivity, duration: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('enfant.placeholderDuration')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('enfant.capacityMax')}</label>
                  <input
                    type="number"
                    value={newActivity.capacity}
                    onChange={(e) => setNewActivity({ ...newActivity, capacity: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('enfant.placeholderCapacity')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('enfant.location')}</label>
                  <input
                    type="text"
                    value={newActivity.location}
                    onChange={(e) => setNewActivity({ ...newActivity, location: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('enfant.placeholderLocation')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('enfant.price')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newActivity.price}
                    onChange={(e) => setNewActivity({ ...newActivity, price: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('enfant.schedule')}</label>
                  <input
                    type="text"
                    value={newActivity.schedule}
                    onChange={(e) => setNewActivity({ ...newActivity, schedule: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('enfant.placeholderSchedule')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('enfant.instructor')}</label>
                  <input
                    type="text"
                    value={newActivity.instructor}
                    onChange={(e) => setNewActivity({ ...newActivity, instructor: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('enfant.placeholderInstructor')}
                  />
                </div>
              </div>

              {/* Upload Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('enfant.activityImage')}</label>
                {imagePreview ? (
                  <div className="relative">
                    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="relative w-32 h-24 rounded-lg overflow-hidden bg-white border border-gray-200">
                          <img src={imagePreview} alt="Activity preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {imageFile?.name || t('enfant.imageSelected')}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {imageFile ? `${(imageFile.size / 1024).toFixed(2)} KB` : t('enfant.existingImage')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={removeImage}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload size={32} className="text-gray-400 mb-2" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">{t('enfant.clickToUpload')}</span> {t('enfant.orDragDrop')}
                      </p>
                      <p className="text-xs text-gray-500">{t('enfant.imageFormats')}</p>
                    </div>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                )}
              </div>

              {/* Caractéristiques */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('enfant.features')}</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {newActivity.features.map((feature, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm"
                    >
                      {feature}
                      <button type="button" onClick={() => removeFeature(feature)} className="hover:text-pink-900">
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addFeature();
                      }
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('enfant.addFeaturePlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={addFeature}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              {/* Statut */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={newActivity.isActive}
                  onChange={(e) => setNewActivity({ ...newActivity, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  {t('enfant.activityActive')}
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-4 p-6 border-t border-gray-200">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={editingActivity ? handleUpdateActivity : handleAddActivity}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save size={18} />
                {editingActivity ? t('common.save') : t('common.add')}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Enfant;
