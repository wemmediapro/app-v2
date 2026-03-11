import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Image, Plus, Edit, Trash2, Search, Filter, Eye, EyeOff, Calendar, Link as LinkIcon, Monitor, Globe, Ship, FileText, X, Upload, Smartphone, Tablet, BarChart2, MousePointer } from 'lucide-react';
import { apiService } from '../services/apiService';
import { availableShips } from '../data/ships';
import { LANG_LIST, emptyTranslations } from '../utils/i18n';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';

const Banners = () => {
  const { t, language } = useLanguage();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [selectedBanner, setSelectedBanner] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imagePreviewMobile, setImagePreviewMobile] = useState(null);
  const [imagePreviewTablet, setImagePreviewTablet] = useState(null);
  const [activeLang, setActiveLang] = useState('fr');
  const [newBanner, setNewBanner] = useState({
    title: '',
    description: '',
    position: 'home-top',
    order: 0,
    image: '',
    imageMobile: '',
    imageTablet: '',
    link: '',
    startDate: '',
    endDate: '',
    isActive: true,
    countries: [],
    ships: [],
    pages: [],
    translations: emptyTranslations()
  });

  // Pays disponibles
  const availableCountries = [
    { name: 'Maroc', code: 'MA' },
    { name: 'Tunisie', code: 'TN' },
    { name: 'Algérie', code: 'DZ' },
    { name: 'Italie', code: 'IT' },
    { name: 'Espagne', code: 'ES' }
  ];


  // Pages disponibles (noms traduits selon la langue)
  const availablePages = [
    { id: 'home', name: t('banners.pageName_home') },
    { id: 'restaurants', name: t('banners.pageName_restaurants') },
    { id: 'shop', name: t('banners.pageName_shop') },
    { id: 'movies', name: t('banners.pageName_movies') },
    { id: 'radio', name: t('banners.pageName_radio') },
    { id: 'magazine', name: t('banners.pageName_magazine') },
    { id: 'webtv', name: t('banners.pageName_webtv') },
    { id: 'enfant', name: t('banners.pageName_enfant') },
    { id: 'shipmap', name: t('banners.pageName_shipmap') },
    { id: 'chat', name: t('banners.pageName_chat') }
  ];

  const getBannerTitle = (banner, lang) => (banner.translations?.[lang]?.title || banner.title || '').trim();
  const getBannerDescription = (banner, lang) => (banner.translations?.[lang]?.description || banner.description || '').trim();

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      try {
        const response = await apiService.getBannersAll();
        setBanners(response.data || []);
      } catch (e) {
        const response = await apiService.getBanners();
        setBanners(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching banners:', error);
      toast.error(t('banners.errorLoadBanners'));
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (bannerId) => {
    try {
      const banner = banners.find(b => b._id === bannerId);
      const newStatus = !banner.isActive;
      await apiService.put(`/banners/${bannerId}`, { isActive: newStatus });
      setBanners(banners.map(b => b._id === bannerId ? { ...b, isActive: newStatus } : b));
      toast.success(newStatus ? t('banners.bannerActivated') : t('banners.bannerDeactivated'));
    } catch (error) {
      toast.error(t('banners.errorUpdate'));
    }
  };

  const handleDelete = async (bannerId) => {
    if (!window.confirm(t('banners.confirmDeleteBanner'))) {
      return;
    }

    try {
      try {
        await apiService.delete(`/banners/${bannerId}`);
        setBanners(banners.filter(b => b._id !== bannerId));
        toast.success(t('banners.bannerDeleted'));
      } catch (error) {
        // Simulation
        setBanners(banners.filter(b => b._id !== bannerId));
        toast.success(t('banners.bannerDeleted'));
      }
    } catch (error) {
      toast.error(t('banners.errorDelete'));
    }
  };

  const toggleCountry = (countryName) => {
    setNewBanner({
      ...newBanner,
      countries: newBanner.countries.includes(countryName)
        ? newBanner.countries.filter(c => c !== countryName)
        : [...newBanner.countries, countryName]
    });
  };

  const toggleShip = (shipId) => {
    setNewBanner({
      ...newBanner,
      ships: newBanner.ships.includes(shipId)
        ? newBanner.ships.filter(s => s !== shipId)
        : [...newBanner.ships, shipId]
    });
  };

  const togglePage = (pageId) => {
    setNewBanner({
      ...newBanner,
      pages: newBanner.pages.includes(pageId)
        ? newBanner.pages.filter(p => p !== pageId)
        : [...newBanner.pages, pageId]
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error(t('banners.selectImage'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('banners.fileTooLarge5MB'));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setNewBanner({ ...newBanner, image: reader.result });
      };
      reader.readAsDataURL(file);
      setImageFile(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setNewBanner({ ...newBanner, image: '' });
  };

  const handleImageUploadMobile = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) { toast.error(t('banners.selectImage')); return; }
      if (file.size > 5 * 1024 * 1024) { toast.error(t('banners.fileTooLarge5MB')); return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewMobile(reader.result);
        setNewBanner({ ...newBanner, imageMobile: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };
  const removeImageMobile = () => {
    setImagePreviewMobile(null);
    setNewBanner({ ...newBanner, imageMobile: '' });
  };

  const handleImageUploadTablet = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) { toast.error(t('banners.selectImage')); return; }
      if (file.size > 5 * 1024 * 1024) { toast.error(t('banners.fileTooLarge5MB')); return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewTablet(reader.result);
        setNewBanner({ ...newBanner, imageTablet: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };
  const removeImageTablet = () => {
    setImagePreviewTablet(null);
    setNewBanner({ ...newBanner, imageTablet: '' });
  };

  const handleAddBanner = async () => {
    if (!newBanner.title || (!newBanner.image && !imagePreview)) {
      toast.error(t('banners.fillTitleAndImage'));
      return;
    }

    try {
      const translations = { fr: { title: newBanner.title, description: newBanner.description || '' } };
      LANG_LIST.forEach(({ code }) => {
        if (code === 'fr') return;
        const t = newBanner.translations?.[code];
        if (t && (t.title || t.description)) {
          translations[code] = { title: t.title || '', description: t.description || '' };
        }
      });
      const banner = {
        ...newBanner,
        title: newBanner.title,
        description: newBanner.description || '',
        translations,
        image: imagePreview || newBanner.image,
        imageMobile: imagePreviewMobile || newBanner.imageMobile || null,
        imageTablet: imagePreviewTablet || newBanner.imageTablet || null,
        _id: selectedBanner?._id || `banner_${Date.now()}`,
        createdAt: selectedBanner?.createdAt || new Date().toISOString()
      };

      try {
        if (selectedBanner) {
          await apiService.updateBanner(selectedBanner._id, banner);
          toast.success(t('banners.bannerUpdated'));
          if (Object.keys(translations).length > 1) toast.success(t('common.contentAddedByLanguage'));
        } else {
          await apiService.createBanner(banner);
          toast.success(t('banners.bannerCreated'));
          if (Object.keys(translations).length > 1) toast.success(t('common.contentAddedByLanguage'));
        }
        fetchBanners();
      } catch (error) {
        // Simulation
        if (selectedBanner) {
          setBanners(banners.map(b => b._id === selectedBanner._id ? banner : b));
          toast.success(t('banners.bannerUpdatedDemo'));
          if (Object.keys(translations).length > 1) toast.success(t('common.contentAddedByLanguage'));
        } else {
          setBanners([...banners, banner]);
          toast.success(t('banners.bannerCreatedDemo'));
          if (Object.keys(translations).length > 1) toast.success(t('common.contentAddedByLanguage'));
        }
      }

      setShowModal(false);
      setSelectedBanner(null);
      setImageFile(null);
      setImagePreview(null);
      setImagePreviewMobile(null);
      setImagePreviewTablet(null);
      setActiveLang('fr');
      setNewBanner({
        title: '',
        description: '',
        position: 'home-top',
        order: 0,
        image: '',
        imageMobile: '',
        imageTablet: '',
        link: '',
        startDate: '',
        endDate: '',
        isActive: true,
        countries: [],
        ships: [],
        pages: [],
        translations: emptyTranslations()
      });
    } catch (error) {
      console.error('Erreur lors de la création/modification:', error);
      toast.error(t('banners.errorCreateUpdate'));
    }
  };

  const filteredBanners = useMemo(() => {
    return banners.filter(banner => {
      const matchesSearch = !searchQuery ||
        banner.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        banner.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && banner.isActive) ||
        (statusFilter === 'inactive' && !banner.isActive);
      const matchesPosition = positionFilter === 'all' || banner.position === positionFilter;
      return matchesSearch && matchesStatus && matchesPosition;
    });
  }, [banners, searchQuery, statusFilter, positionFilter]);

  const activeBanners = banners.filter(b => b.isActive);
  const totalImpressions = useMemo(() => banners.reduce((acc, b) => acc + (Number(b.impressions) || 0), 0), [banners]);
  const totalClicks = useMemo(() => banners.reduce((acc, b) => acc + (Number(b.clicks) || 0), 0), [banners]);
  const positions = useMemo(() => {
    const pos = new Set(banners.map(b => b.position));
    return Array.from(pos).sort();
  }, [banners]);

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

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* En-tête compact */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">{t('banners.pageTitle')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('banners.pageSubtitle')}</p>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setSelectedBanner(null);
            setImageFile(null);
            setImagePreview(null);
            setActiveLang('fr');
            setNewBanner({
              title: '',
              description: '',
              position: 'home-top',
              order: 0,
              image: '',
              imageMobile: '',
              imageTablet: '',
              link: '',
              startDate: '',
              endDate: '',
              isActive: true,
              countries: [],
              ships: [],
              pages: [],
              translations: emptyTranslations()
            });
            setShowModal(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors shrink-0"
        >
          <Plus size={18} />
          {t('banners.addBanner')}
        </motion.button>
      </div>

      {/* Stats compactes */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><Image size={18} className="text-slate-600" /></div>
          <div><p className="text-xs font-medium text-slate-500">{t('banners.totalBanners')}</p><p className="text-lg font-semibold text-slate-800 tabular-nums">{banners.length}</p></div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50"><Eye size={18} className="text-emerald-600" /></div>
          <div><p className="text-xs font-medium text-slate-500">{t('banners.activeCount')}</p><p className="text-lg font-semibold text-slate-800 tabular-nums">{activeBanners.length}</p></div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><EyeOff size={18} className="text-slate-600" /></div>
          <div><p className="text-xs font-medium text-slate-500">{t('banners.inactiveCount')}</p><p className="text-lg font-semibold text-slate-800 tabular-nums">{banners.length - activeBanners.length}</p></div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50"><Monitor size={18} className="text-violet-600" /></div>
          <div><p className="text-xs font-medium text-slate-500">{t('banners.positionsCount')}</p><p className="text-lg font-semibold text-slate-800 tabular-nums">{positions.length}</p></div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50"><BarChart2 size={18} className="text-amber-600" /></div>
          <div><p className="text-xs font-medium text-slate-500">{t('banners.impressionsCount')}</p><p className="text-lg font-semibold text-slate-800 tabular-nums">{totalImpressions.toLocaleString()}</p></div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50"><MousePointer size={18} className="text-emerald-600" /></div>
          <div><p className="text-xs font-medium text-slate-500">{t('banners.clicksCount')}</p><p className="text-lg font-semibold text-slate-800 tabular-nums">{totalClicks.toLocaleString()}</p></div>
        </div>
      </div>

      {/* Recherche + filtres */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t('banners.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-colors"
          />
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-slate-50/80 p-1 gap-0.5 shrink-0">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3.5 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
            <option value="all">{t('banners.allStatuses')}</option>
            <option value="active">{t('banners.active')}</option>
            <option value="inactive">{t('banners.inactive')}</option>
          </select>
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="px-3.5 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">{t('banners.allPositions')}</option>
            {positions.map(position => (
              <option key={position} value={position}>{position}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Banners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBanners.map((banner) => (
          <motion.div
            key={banner._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="relative aspect-video bg-gradient-to-br from-blue-100 to-purple-100">
              {banner.image ? (
                <img 
                  src={banner.image} 
                  alt={getBannerTitle(banner, language)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image size={48} className="text-gray-400" />
                </div>
              )}
              {!banner.isActive && (
                <div className="absolute top-2 right-2 bg-gray-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                  {t('banners.badgeInactive')}
                </div>
              )}
              {banner.isActive && (
                <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                  {t('banners.badgeActive')}
                </div>
              )}
              <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                {banner.position}
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">{getBannerTitle(banner, language)}</h3>
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">{getBannerDescription(banner, language)}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                {banner.startDate && (
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    <span>{t('banners.dateFrom')} {new Date(banner.startDate).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
                {banner.endDate && (
                  <div className="flex items-center gap-1">
                    <span>{t('banners.dateTo')} {new Date(banner.endDate).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
              </div>
              {banner.link && (
                <div className="flex items-center gap-1 text-xs text-blue-600 mb-3">
                  <LinkIcon size={14} />
                  <span className="truncate">{banner.link}</span>
                </div>
              )}
              {/* Statistiques affichage / clics */}
              <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                <span className="flex items-center gap-1"><BarChart2 size={12} /> {(banner.impressions ?? 0).toLocaleString()} {t('banners.impressionsLabel')}</span>
                <span className="flex items-center gap-1"><MousePointer size={12} /> {(banner.clicks ?? 0).toLocaleString()} {t('banners.clicksLabel')}</span>
                {(banner.impressions > 0) && (
                  <span>CTR {((100 * (banner.clicks ?? 0)) / banner.impressions).toFixed(1)} %</span>
                )}
              </div>
              {/* Affichage des affectations */}
              {(banner.countries?.length > 0 || banner.ships?.length > 0 || banner.pages?.length > 0) && (
                <div className="space-y-2 mb-3">
                  {banner.countries?.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <Globe size={12} className="text-gray-400" />
                      {banner.countries.map((country, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                          {country}
                        </span>
                      ))}
                    </div>
                  )}
                  {banner.ships?.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <Ship size={12} className="text-gray-400" />
                      {banner.ships.map((shipId, idx) => {
                        const ship = availableShips.find(s => s.id === shipId);
                        return ship ? (
                          <span key={idx} className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                            {ship.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                  {banner.pages?.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <FileText size={12} className="text-gray-400" />
                      {banner.pages.map((pageId, idx) => {
                        const page = availablePages.find(p => p.id === pageId);
                        return page ? (
                          <span key={idx} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                            {page.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleToggleStatus(banner._id)}
                  className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg transition-colors ${
                    banner.isActive
                      ? 'text-orange-600 hover:bg-orange-50'
                      : 'text-green-600 hover:bg-green-50'
                  }`}
                >
                  {banner.isActive ? <EyeOff size={16} /> : <Eye size={16} />}
                  <span className="text-xs">{banner.isActive ? t('banners.disable') : t('banners.enable')}</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedBanner(banner);
                    setImageFile(null);
                    setImagePreview(banner.image || null);
                    setImagePreviewMobile(banner.imageMobile || null);
                    setImagePreviewTablet(banner.imageTablet || null);
                    setActiveLang('fr');
                    setNewBanner({
                      title: banner.title || '',
                      description: banner.description || '',
                      position: banner.position || 'home-top',
                      order: banner.order || 0,
                      image: banner.image || '',
                      imageMobile: banner.imageMobile || '',
                      imageTablet: banner.imageTablet || '',
                      link: banner.link || '',
                      startDate: banner.startDate || '',
                      endDate: banner.endDate || '',
                      isActive: banner.isActive !== undefined ? banner.isActive : true,
                      countries: banner.countries || [],
                      ships: banner.ships || [],
                      pages: banner.pages || [],
                      translations: banner.translations && typeof banner.translations === 'object' ? { ...emptyTranslations(), ...banner.translations } : emptyTranslations()
                    });
                    setShowModal(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit size={16} />
                  <span className="text-xs">{t('banners.edit')}</span>
                </button>
                <button
                  onClick={() => handleDelete(banner._id)}
                  className="flex-1 flex items-center justify-center gap-2 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                  <span className="text-xs">{t('banners.delete')}</span>
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        {filteredBanners.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Image size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('banners.noBannersFound')}</p>
          </div>
        )}
      </div>

      {/* Modal {t('banners.addBanner')} / Modifier — interface moderne */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200/80"
          >
            <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600">
                  <Image size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {selectedBanner ? t('banners.editBanner') : t('banners.addBanner')}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedBanner ? t('banners.modalUpdateInfo') : t('banners.modalFillFields')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedBanner(null);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label={t('banners.close')}
              >
                <X size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('banners.contentByLanguage')}</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {LANG_LIST.map(({ code, label }) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setActiveLang(code)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeLang === code ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {activeLang === 'fr' ? (
                    <>
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('banners.titleRequired')}</label>
                        <input
                          type="text"
                          value={newBanner.title}
                          onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                          placeholder={t('banners.placeholderTitle')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('banners.descriptionLabel')}</label>
                        <textarea
                          value={newBanner.description || ''}
                          onChange={(e) => setNewBanner({ ...newBanner, description: e.target.value })}
                          rows={3}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                          placeholder={t('banners.placeholderDescription')}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('banners.titleLabel')}</label>
                        <input
                          type="text"
                          value={newBanner.translations?.[activeLang]?.title || ''}
                          onChange={(e) => setNewBanner({
                            ...newBanner,
                            translations: {
                              ...newBanner.translations,
                              [activeLang]: { ...newBanner.translations?.[activeLang], title: e.target.value }
                            }
                          })}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                          placeholder={t('banners.titleLabel')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('banners.descriptionLabel')}</label>
                        <textarea
                          value={newBanner.translations?.[activeLang]?.description || ''}
                          onChange={(e) => setNewBanner({
                            ...newBanner,
                            translations: {
                              ...newBanner.translations,
                              [activeLang]: { ...newBanner.translations?.[activeLang], description: e.target.value }
                            }
                          })}
                          rows={3}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                          placeholder={t('banners.descriptionLabel')}
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('banners.positionLabel')}</label>
                    <select
                      value={newBanner.position}
                      onChange={(e) => setNewBanner({ ...newBanner, position: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    >
                      <option value="home-top">{t('banners.positionHomeTop')}</option>
                      <option value="home-middle">{t('banners.positionHomeMiddle')}</option>
                      <option value="home-bottom">{t('banners.positionHomeBottom')}</option>
                      <option value="restaurants-top">{t('banners.positionRestaurantsTop')}</option>
                      <option value="shop-top">{t('banners.positionShopTop')}</option>
                      <option value="movies-top">{t('banners.positionMoviesTop')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('banners.orderLabel')}</label>
                    <input
                      type="number"
                      value={newBanner.order}
                      onChange={(e) => setNewBanner({ ...newBanner, order: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                      placeholder="0"
                    />
                  </div>
                </div>
                {/* Upload Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('banners.imageBannerRequired')}
                  </label>
                  {imagePreview ? (
                    <div className="relative">
                      <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center gap-4">
                          <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-white border border-gray-200">
                            <img
                              src={imagePreview}
                              alt="Banner preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {imageFile?.name || t('banners.imageSelected')}
                            </p>
                            {imageFile && (
                              <p className="text-xs text-gray-500 mt-1">
                                {(imageFile.size / 1024).toFixed(2)} KB
                              </p>
                            )}
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
                          <span className="font-semibold">{t('banners.clickToUpload')}</span> {t('banners.orDragDrop')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t('banners.imageFormats')}
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                {/* Image Mobile (optionnel) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Smartphone size={16} className="text-indigo-600" />
                    {t('banners.imageMobileOptional')}
                  </label>
                  {imagePreviewMobile ? (
                    <div className="relative flex items-center gap-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="w-24 h-14 rounded overflow-hidden bg-white border border-gray-200">
                        <img src={imagePreviewMobile} alt="Mobile" className="w-full h-full object-cover" />
                      </div>
                      <button type="button" onClick={removeImageMobile} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <Upload size={20} className="text-gray-400" />
                      <span className="text-sm text-gray-500">{t('banners.addMobileImage')}</span>
                      <input type="file" accept="image/*" onChange={handleImageUploadMobile} className="hidden" />
                    </label>
                  )}
                </div>
                {/* Image Tablette (optionnel) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Tablet size={16} className="text-indigo-600" />
                    {t('banners.imageTabletOptional')}
                  </label>
                  {imagePreviewTablet ? (
                    <div className="relative flex items-center gap-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="w-32 h-16 rounded overflow-hidden bg-white border border-gray-200">
                        <img src={imagePreviewTablet} alt="Tablette" className="w-full h-full object-cover" />
                      </div>
                      <button type="button" onClick={removeImageTablet} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <Upload size={20} className="text-gray-400" />
                      <span className="text-sm text-gray-500">{t('banners.addTabletImage')}</span>
                      <input type="file" accept="image/*" onChange={handleImageUploadTablet} className="hidden" />
                    </label>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('banners.linkOptional')}</label>
                  <input
                    type="url"
                    value={newBanner.link}
                    onChange={(e) => setNewBanner({ ...newBanner, link: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    placeholder="https://example.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('banners.startDate')}</label>
                    <input
                      type="date"
                      value={newBanner.startDate}
                      onChange={(e) => setNewBanner({ ...newBanner, startDate: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('banners.endDate')}</label>
                    <input
                      type="date"
                      value={newBanner.endDate}
                      onChange={(e) => setNewBanner({ ...newBanner, endDate: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    />
                  </div>
                </div>

                {/* Affecter aux pays */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Globe size={16} className="text-blue-600" />
                    {t('banners.assignCountries')}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg">
                    {availableCountries.map((country) => (
                      <label key={country.code} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newBanner.countries.includes(country.name)}
                          onChange={() => toggleCountry(country.name)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{country.name}</span>
                      </label>
                    ))}
                  </div>
                  {newBanner.countries.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {newBanner.countries.map((country) => (
                        <span key={country} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                          {country}
                          <button
                            onClick={() => toggleCountry(country)}
                            className="hover:text-blue-900"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Affecter aux bateaux */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Ship size={16} className="text-green-600" />
                    {t('banners.assignShips')}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg">
                    {availableShips.map((ship) => (
                      <label key={ship.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newBanner.ships.includes(ship.id)}
                          onChange={() => toggleShip(ship.id)}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700">{ship.name}</span>
                      </label>
                    ))}
                  </div>
                  {newBanner.ships.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {newBanner.ships.map((shipId) => {
                        const ship = availableShips.find(s => s.id === shipId);
                        return ship ? (
                          <span key={shipId} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                            {ship.name}
                            <button
                              onClick={() => toggleShip(shipId)}
                              className="hover:text-green-900"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                {/* Affecter aux pages */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <FileText size={16} className="text-purple-600" />
                    {t('banners.assignPages')}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg">
                    {availablePages.map((page) => (
                      <label key={page.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newBanner.pages.includes(page.id)}
                          onChange={() => togglePage(page.id)}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">{page.name}</span>
                      </label>
                    ))}
                  </div>
                  {newBanner.pages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {newBanner.pages.map((pageId) => {
                        const page = availablePages.find(p => p.id === pageId);
                        return page ? (
                          <span key={pageId} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                            {page.name}
                            <button
                              onClick={() => togglePage(pageId)}
                              className="hover:text-purple-900"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newBanner.isActive}
                    onChange={(e) => setNewBanner({ ...newBanner, isActive: e.target.checked })}
                    id="isActive"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                    {t('banners.bannerActive')}
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setShowModal(false);
                  setSelectedBanner(null);
                  setImageFile(null);
                  setImagePreview(null);
                  setImagePreviewMobile(null);
                  setImagePreviewTablet(null);
                  setNewBanner({
                    title: '',
                    description: '',
                    position: 'home-top',
                    order: 0,
                    image: '',
                    imageMobile: '',
                    imageTablet: '',
                    link: '',
                    startDate: '',
                    endDate: '',
                    isActive: true,
                    countries: [],
                    ships: [],
                    pages: [],
                    translations: emptyTranslations()
                  });
                }}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-white hover:border-slate-300 transition-colors"
              >
                {t('banners.cancel')}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddBanner}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
              >
                {selectedBanner ? t('common.save') : t('banners.createBanner')}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Banners;



