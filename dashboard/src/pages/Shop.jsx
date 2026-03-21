import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingBag,
  Plus,
  Edit,
  Trash2,
  Search,
  DollarSign,
  Package,
  Filter,
  Star,
  TrendingDown,
  X,
  Upload,
  Globe,
  Ship,
  Tag,
  Calendar,
  Percent,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import FilterBar from '../components/FilterBar';
import { apiService } from '../services/apiService';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useBoatConfig } from '../contexts/BoatConfigContext';
import { LANG_LIST, emptyTranslations } from '../utils/i18n';

/** URL d’image : chemins relatifs préfixés par l’origine pour le proxy */
function getImageSrc(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return origin ? `${origin}${url.startsWith('/') ? '' : '/'}${url}` : url;
}

function getProductImageUrl(product) {
  const url = product?.images?.[0]?.url || product?.imageUrl || product?.image;
  return typeof url === 'string' ? url.trim() : '';
}

const Shop = () => {
  const { t, language } = useLanguage();
  const { boatConfig } = useBoatConfig();

  /** Nom du produit selon la langue (translations ou name par défaut) */
  const getProductName = (product, lang) => {
    const tr = product?.translations?.[lang];
    return (tr?.name || product?.name || '').trim();
  };
  /** Description du produit selon la langue */
  const getProductDescription = (product, lang) => {
    const tr = product?.translations?.[lang];
    return (tr?.description ?? product?.description ?? '').trim();
  };
  /** Libellé de catégorie (traduit si disponible) */
  const getCategoryLabel = (category) => {
    if (!category) return '';
    const key = 'shop.categories.' + category;
    const label = t(key);
    return label === key ? category : label;
  };
  const emptyPromoTranslations = () => ({
    fr: { title: '', description: '' },
    en: { title: '', description: '' },
    es: { title: '', description: '' },
    it: { title: '', description: '' },
    de: { title: '', description: '' },
    ar: { title: '', description: '' },
  });

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [destinationFilter, setDestinationFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null); // promotion en cours d'édition
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [promotions, setPromotions] = useState([]);
  const [newPromotion, setNewPromotion] = useState({
    title: '',
    description: '',
    translations: emptyPromoTranslations(),
    discountType: 'percentage', // 'percentage' or 'fixed'
    discountValue: 0,
    productIds: [],
    countries: [], // Array of country names
    validFrom: '',
    validUntil: '',
    isActive: true,
  });
  const [activeLang, setActiveLang] = useState('fr');
  const [promoActiveLang, setPromoActiveLang] = useState('fr');
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    category: '',
    price: 0,
    originalPrice: 0,
    stock: 0,
    sku: '',
    type: 'physical',
    rating: 0,
    tags: [],
    ships: [],
    isActive: true,
    translations: emptyTranslations(),
  });
  const [newTag, setNewTag] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editActiveLang, setEditActiveLang] = useState('fr');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Types de produit acceptés par l'API (Product.type enum)
  const PRODUCT_TYPE_OPTIONS = [
    { value: 'physical', label: 'Physique' },
    { value: 'digital', label: 'Digital' },
    { value: 'service', label: 'Service' },
  ];

  // Pays disponibles
  const availableCountries = [
    { name: 'Maroc', code: 'MA' },
    { name: 'Tunisie', code: 'TN' },
    { name: 'Algérie', code: 'DZ' },
    { name: 'Italie', code: 'IT' },
    { name: 'Espagne', code: 'ES' },
  ];

  // Catégories disponibles (synchronisées avec le frontend)
  const availableCategories = ['souvenirs', 'dutyfree', 'fashion', 'electronics', 'food'];

  useEffect(() => {
    fetchProducts();
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      const response = await apiService.getPromotions();
      const data = response.data;
      const list = Array.isArray(data) ? data : data?.promotions || data?.data || [];
      setPromotions(list);
    } catch (error) {
      console.error('Erreur lors du chargement des promotions:', error);
      setPromotions([]);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await apiService.getProducts('all=1');
      const data = Array.isArray(response.data) ? response.data : response.data?.products || response.data?.data || [];
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error(t('shop.errorLoadProducts'));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set(products.map((product) => product.category));
    return Array.from(cats).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const nameForLang = getProductName(product, language);
      const descForLang = getProductDescription(product, language);
      const matchesSearch =
        searchQuery === '' ||
        nameForLang.toLowerCase().includes(searchQuery.toLowerCase()) ||
        descForLang.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.features &&
          product.features.some((feature) => feature.toLowerCase().includes(searchQuery.toLowerCase()))) ||
        product.sku?.toLowerCase().includes(searchQuery.toLowerCase());

      // Catégorie (synchronisée avec le frontend)
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;

      // Filtres supplémentaires pour le dashboard (statut, bateau, pays, destination)
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && product.isActive) ||
        (statusFilter === 'inactive' && !product.isActive) ||
        (statusFilter === 'out_of_stock' && product.stock === 0);
      const matchesShip = true;
      const matchesCountry =
        countryFilter === 'all' ||
        (product.countries &&
          product.countries.some((country) => country.toLowerCase().includes(countryFilter.toLowerCase())));
      const matchesDestination =
        destinationFilter === 'all' ||
        (product.destination && product.destination.toLowerCase().includes(destinationFilter.toLowerCase()));

      return matchesSearch && matchesCategory && matchesStatus && matchesShip && matchesCountry && matchesDestination;
    });
  }, [products, searchQuery, categoryFilter, statusFilter, countryFilter, destinationFilter, language]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error(t('shop.selectValidImage'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('shop.imageMax5MB'));
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleEditProduct = (product) => {
    setEditingProduct({
      ...product,
      translations:
        product.translations && typeof product.translations === 'object'
          ? { ...emptyTranslations(), ...product.translations }
          : emptyTranslations(),
    });
    setEditActiveLang('fr');
    setEditImageFile(null);
    const imgUrl = product.images?.[0]?.url || product.imageUrl || product.image || '';
    setEditImagePreview(imgUrl || null);
  };

  const handleEditImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error(t('shop.selectValidImage'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('shop.imageMax5MB'));
        return;
      }
      setEditImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setEditImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const removeEditImage = () => {
    setEditImageFile(null);
    setEditImagePreview(null);
    setEditingProduct((prev) => (prev ? { ...prev, imageUrl: '', images: [] } : null));
  };

  const handleSaveEditProduct = async () => {
    if (!editingProduct?.name?.trim() || !editingProduct?.category) {
      toast.error(t('shop.fillNameCategory'));
      return;
    }
    const id = editingProduct._id || editingProduct.id;
    if (!id) {
      toast.error(t('shop.productIdMissing'));
      return;
    }
    try {
      let imageUrl = editingProduct.images?.[0]?.url || editingProduct.imageUrl || editingProduct.image || '';
      if (editImageFile) {
        setUploadingImage(true);
        const up = await apiService.uploadImage(editImageFile);
        imageUrl = up?.image?.path || up?.image?.url || up?.data?.image?.path || up?.data?.image?.url || imageUrl;
        setUploadingImage(false);
      }
      const translations = { fr: { name: editingProduct.name, description: editingProduct.description || '' } };
      LANG_LIST.forEach(({ code }) => {
        if (code === 'fr') return;
        const t = editingProduct.translations?.[code];
        if (t && (t.name || t.description)) {
          translations[code] = { name: t.name || '', description: t.description || '' };
        }
      });
      const payload = {
        name: editingProduct.name,
        description: editingProduct.description || '',
        category: editingProduct.category,
        price: editingProduct.price ?? 0,
        originalPrice: editingProduct.originalPrice ?? 0,
        stock: editingProduct.stock ?? 0,
        sku: editingProduct.sku || '',
        type: editingProduct.type || 'physical',
        rating: editingProduct.rating ?? 0,
        tags: editingProduct.tags || [],
        ships: editingProduct.ships || [],
        isActive: editingProduct.isActive !== false,
        images: imageUrl ? [{ url: imageUrl, alt: editingProduct.name, isPrimary: true }] : editingProduct.images || [],
        translations,
      };
      await apiService.updateProduct(id, payload);
      toast.success(t('shop.productUpdated'));
      if (Object.keys(translations).length > 1) toast.success(t('common.contentAddedByLanguage'));
      setEditingProduct(null);
      setEditImageFile(null);
      setEditImagePreview(null);
      fetchProducts();
    } catch (error) {
      setUploadingImage(false);
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  };

  const handleDeleteProduct = async (product) => {
    const displayName = getProductName(product, language);
    if (!window.confirm(t('shop.confirmDeleteProduct', { name: displayName }))) return;
    const id = product._id || product.id;
    if (!id) {
      toast.error(t('shop.productIdMissing'));
      return;
    }
    try {
      await apiService.deleteProduct(id);
      toast.success(t('shop.productDeleted'));
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const toggleProductForPromo = (productId) => {
    setNewPromotion({
      ...newPromotion,
      productIds: newPromotion.productIds.includes(productId)
        ? newPromotion.productIds.filter((id) => id !== productId)
        : [...newPromotion.productIds, productId],
    });
  };

  const toggleCountryForPromo = (countryName) => {
    setNewPromotion({
      ...newPromotion,
      countries: newPromotion.countries.includes(countryName)
        ? newPromotion.countries.filter((c) => c !== countryName)
        : [...newPromotion.countries, countryName],
    });
  };

  const getPromoTitle = (promo, lang) =>
    (promo?.translations?.[lang]?.title || promo?.translations?.fr?.title || promo?.title || '').trim();
  const getPromoDescription = (promo, lang) =>
    (
      promo?.translations?.[lang]?.description ||
      promo?.translations?.fr?.description ||
      promo?.description ||
      ''
    ).trim();

  const handleAddPromotion = async () => {
    const title = getPromoTitle(newPromotion, 'fr');
    const description = getPromoDescription(newPromotion, 'fr');
    if (!title || !description) {
      toast.error(t('shop.fillTitleDescriptionFr'));
      return;
    }

    if (newPromotion.discountValue <= 0) {
      toast.error(t('shop.discountGreaterThanZero'));
      return;
    }

    if (!newPromotion.validFrom || !newPromotion.validUntil) {
      toast.error(t('shop.selectDates'));
      return;
    }

    if (new Date(newPromotion.validUntil) < new Date(newPromotion.validFrom)) {
      toast.error(t('shop.endDateAfterStart'));
      return;
    }

    try {
      const payload = {
        title,
        description,
        translations: newPromotion.translations || {},
        discountType: newPromotion.discountType || 'percentage',
        discountValue: newPromotion.discountValue ?? 0,
        productIds: newPromotion.productIds || [],
        countries: newPromotion.countries || [],
        validFrom: newPromotion.validFrom || null,
        validUntil: newPromotion.validUntil || null,
        isActive: newPromotion.isActive !== false,
      };
      const res = await apiService.createPromotion(payload);
      const created = res.data;
      setPromotions((prev) => [created, ...prev]);
      toast.success(t('shop.promotionAdded'));

      setNewPromotion({
        title: '',
        description: '',
        translations: emptyPromoTranslations(),
        discountType: 'percentage',
        discountValue: 0,
        productIds: [],
        countries: [],
        validFrom: '',
        validUntil: '',
        isActive: true,
      });
      setPromoActiveLang('fr');
      setShowPromoModal(false);
    } catch (error) {
      console.error("Erreur lors de l'ajout de la promotion:", error);
      toast.error(error.response?.data?.message || t('shop.errorAddPromotion'));
    }
  };

  const openEditPromotion = (promo) => {
    const from = promo.validFrom
      ? typeof promo.validFrom === 'string'
        ? promo.validFrom.slice(0, 10)
        : new Date(promo.validFrom).toISOString().slice(0, 10)
      : '';
    const until = promo.validUntil
      ? typeof promo.validUntil === 'string'
        ? promo.validUntil.slice(0, 10)
        : new Date(promo.validUntil).toISOString().slice(0, 10)
      : '';
    const translations = { ...emptyPromoTranslations() };
    if (promo.translations && typeof promo.translations === 'object') {
      LANG_LIST.forEach(({ code }) => {
        if (promo.translations[code]) {
          translations[code] = {
            title: promo.translations[code].title ?? '',
            description: promo.translations[code].description ?? '',
          };
        }
      });
    }
    if (!translations.fr.title && promo.title) translations.fr.title = promo.title;
    if (!translations.fr.description && promo.description) translations.fr.description = promo.description;
    setNewPromotion({
      title: promo.title || '',
      description: promo.description || '',
      translations,
      discountType: promo.discountType || 'percentage',
      discountValue: promo.discountValue ?? 0,
      productIds: Array.isArray(promo.productIds) ? [...promo.productIds] : [],
      countries: Array.isArray(promo.countries) ? [...promo.countries] : [],
      validFrom: from,
      validUntil: until,
      isActive: promo.isActive !== false,
    });
    setPromoActiveLang('fr');
    setEditingPromotion(promo);
    setShowPromoModal(true);
  };

  const handleUpdatePromotion = async () => {
    if (!editingPromotion) return;
    const title = getPromoTitle(newPromotion, 'fr');
    const description = getPromoDescription(newPromotion, 'fr');
    if (!title || !description) {
      toast.error(t('shop.fillTitleDescriptionFr'));
      return;
    }
    if (newPromotion.discountValue <= 0) {
      toast.error(t('shop.discountGreaterThanZero'));
      return;
    }
    if (!newPromotion.validFrom || !newPromotion.validUntil) {
      toast.error(t('shop.selectDates'));
      return;
    }
    if (new Date(newPromotion.validUntil) < new Date(newPromotion.validFrom)) {
      toast.error(t('shop.endDateAfterStart'));
      return;
    }
    try {
      const payload = {
        title: getPromoTitle(newPromotion),
        description: getPromoDescription(newPromotion),
        translations: newPromotion.translations || {},
        discountType: newPromotion.discountType || 'percentage',
        discountValue: newPromotion.discountValue ?? 0,
        productIds: newPromotion.productIds || [],
        countries: newPromotion.countries || [],
        validFrom: newPromotion.validFrom || null,
        validUntil: newPromotion.validUntil || null,
        isActive: newPromotion.isActive !== false,
      };
      const res = await apiService.updatePromotion(editingPromotion.id, payload);
      const updated = res.data;
      setPromotions((prev) => prev.map((p) => (p.id === editingPromotion.id ? updated : p)));
      toast.success(t('shop.promotionUpdated'));
      setNewPromotion({
        title: '',
        description: '',
        translations: emptyPromoTranslations(),
        discountType: 'percentage',
        discountValue: 0,
        productIds: [],
        countries: [],
        validFrom: '',
        validUntil: '',
        isActive: true,
      });
      setEditingPromotion(null);
      setPromoActiveLang('fr');
      setShowPromoModal(false);
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
      toast.error(error.response?.data?.message || t('shop.errorUpdatePromotion'));
    }
  };

  const handleDeletePromotion = async (promo) => {
    const displayTitle = getPromoTitle(promo, language);
    if (!window.confirm(t('shop.confirmDeletePromotion', { title: displayTitle }))) return;
    try {
      await apiService.deletePromotion(promo.id);
      setPromotions((prev) => prev.filter((p) => p.id !== promo.id));
      toast.success(t('shop.promotionDeleted'));
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const closePromoModal = () => {
    setShowPromoModal(false);
    setEditingPromotion(null);
    setNewPromotion({
      title: '',
      description: '',
      translations: emptyPromoTranslations(),
      discountType: 'percentage',
      discountValue: 0,
      productIds: [],
      countries: [],
      validFrom: '',
      validUntil: '',
      isActive: true,
    });
    setPromoActiveLang('fr');
  };

  const addTag = () => {
    if (newTag.trim() && !newProduct.tags.includes(newTag.trim())) {
      setNewProduct({
        ...newProduct,
        tags: [...newProduct.tags, newTag.trim()],
      });
      setNewTag('');
    }
  };

  const removeTag = (tag) => {
    setNewProduct({
      ...newProduct,
      tags: newProduct.tags.filter((t) => t !== tag),
    });
  };

  const handleAddProduct = async () => {
    const frName = (newProduct.translations?.fr?.name ?? newProduct.name)?.trim();
    const frDesc = (newProduct.translations?.fr?.description ?? newProduct.description)?.trim() ?? '';
    if (!frName || !newProduct.category) {
      toast.error(t('shop.fillNameCategory'));
      return;
    }
    if ((newProduct.price ?? 0) <= 0) {
      toast.error(t('shop.priceGreaterThanZero'));
      return;
    }
    if (!imageFile) {
      toast.error(t('shop.addImage'));
      return;
    }

    try {
      setUploadingImage(true);
      const up = await apiService.uploadImage(imageFile);
      // Préférer le chemin relatif pour que l'image s'affiche correctement (même origine)
      const imageUrl = up?.image?.path || up?.image?.url || up?.data?.image?.path || up?.data?.image?.url;
      setUploadingImage(false);
      if (!imageUrl) throw new Error('URL image manquante après upload');

      const translations = {};
      LANG_LIST.forEach(({ code }) => {
        if (code === 'fr') {
          translations.fr = { name: frName, description: frDesc };
          return;
        }
        const t = newProduct.translations?.[code] || {};
        if (t.name?.trim() || t.description?.trim()) {
          translations[code] = { name: t.name || '', description: t.description || '' };
        }
      });

      const payload = {
        name: frName,
        description: frDesc,
        category: newProduct.category,
        price: newProduct.price ?? 0,
        originalPrice: newProduct.originalPrice ?? 0,
        stock: newProduct.stock ?? 0,
        sku: newProduct.sku || '',
        type: newProduct.type || 'physical',
        rating: newProduct.rating ?? 0,
        tags: newProduct.tags || [],
        ships: newProduct.ships || [],
        isActive: newProduct.isActive !== false,
        images: [{ url: imageUrl, alt: frName, isPrimary: true }],
        translations,
      };
      await apiService.createProduct(payload);
      toast.success(t('shop.productAdded'));
      if (Object.keys(translations).length > 1) toast.success(t('common.contentAddedByLanguage'));

      setImageFile(null);
      setImagePreview(null);
      setNewTag('');
      setActiveLang('fr');
      setNewProduct({
        name: '',
        description: '',
        category: '',
        price: 0,
        originalPrice: 0,
        stock: 0,
        sku: '',
        type: '',
        rating: 0,
        tags: [],
        ships: [],
        isActive: true,
        translations: emptyTranslations(),
      });
      setShowAddModal(false);
      fetchProducts();
    } catch (error) {
      setUploadingImage(false);
      console.error("Erreur lors de l'ajout du produit:", error);
      const message = error.response?.data?.message || error.message || "Erreur lors de l'ajout du produit";
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-500">Chargement des produits...</p>
        </div>
      </div>
    );
  }

  const hasActiveFilters = countryFilter !== 'all' || destinationFilter !== 'all';

  return (
    <div className="space-y-6 pb-8 w-full">
      {/* En-tête compact */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">{t('shop.title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? t('common.loading') : t('shop.totalProducts') + ' : ' + products.length}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setNewPromotion({
                title: '',
                description: '',
                translations: emptyPromoTranslations(),
                discountType: 'percentage',
                discountValue: 0,
                productIds: [],
                countries: [],
                validFrom: '',
                validUntil: '',
                isActive: true,
              });
              setEditingPromotion(null);
              setShowPromoModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 shrink-0"
          >
            <Tag size={18} />
            {t('shop.addPromo')}
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setImageFile(null);
              setImagePreview(null);
              setNewTag('');
              setActiveLang('fr');
              setNewProduct({
                name: '',
                description: '',
                category: '',
                price: 0,
                originalPrice: 0,
                stock: 0,
                sku: '',
                type: '',
                rating: 0,
                tags: [],
                ships: [],
                isActive: true,
                translations: emptyTranslations(),
              });
              setShowAddModal(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors shrink-0"
          >
            <Plus size={18} />
            {t('shop.addProduct')}
          </motion.button>
        </div>
      </div>

      {/* Stats compactes */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
            <Package size={18} className="text-slate-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total</p>
            <p className="text-lg font-semibold text-slate-800 tabular-nums">{products.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
            <ShoppingBag size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">{t('shop.inStock')}</p>
            <p className="text-lg font-semibold text-slate-800 tabular-nums">
              {products.filter((p) => p.stock > 0 && p.isActive).length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
            <DollarSign size={18} className="text-violet-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">{t('shop.totalRevenue')}</p>
            <p className="text-lg font-semibold text-slate-800 tabular-nums">
              {products
                .reduce((sum, p) => sum + (p.price ?? 0) * (p.sold || 0), 0)
                .toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              €
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
            <TrendingDown size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">{t('shop.totalSales')}</p>
            <p className="text-lg font-semibold text-slate-800 tabular-nums">
              {products.reduce((sum, p) => sum + (p.sold || 0), 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Promotions — bloc compact */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Tag size={18} className="text-emerald-600" />
            {t('shop.promotionsSectionTitle')} ({promotions.length})
          </h2>
          <button
            type="button"
            onClick={() => {
              setNewPromotion({
                title: '',
                description: '',
                translations: emptyPromoTranslations(),
                discountType: 'percentage',
                discountValue: 0,
                productIds: [],
                countries: [],
                validFrom: '',
                validUntil: '',
                isActive: true,
              });
              setEditingPromotion(null);
              setShowPromoModal(true);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus size={16} />
            {t('shop.addPromotionButton')}
          </button>
        </div>
        {promotions.length === 0 ? (
          <p className="text-slate-500 text-sm py-2">{t('shop.noPromotionsEmpty')}</p>
        ) : (
          <div className="space-y-2">
            {promotions.map((promo) => (
              <motion.div
                key={promo.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-wrap items-center justify-between gap-3 p-3 border border-slate-100 rounded-xl hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-800 truncate text-sm">
                    {getPromoTitle(promo, language) || '(Sans titre)'}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                    {getPromoDescription(promo, language) || '—'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Percent size={11} />
                      {promo.discountType === 'percentage' ? `-${promo.discountValue}%` : `-${promo.discountValue} €`}
                    </span>
                    {promo.validFrom && promo.validUntil && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={11} />
                        {typeof promo.validFrom === 'string' ? promo.validFrom.slice(0, 10) : ''} →{' '}
                        {typeof promo.validUntil === 'string' ? promo.validUntil.slice(0, 10) : ''}
                      </span>
                    )}
                    {promo.isActive !== false ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                        {t('shop.activeBadge')}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {t('shop.inactiveBadge')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditPromotion(promo)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title={t('common.edit')}
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePromotion(promo)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title={t('common.delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Recherche + filtres + filtres avancés repliables */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder={t('shop.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex rounded-xl border border-slate-200 bg-slate-50/80 p-1 gap-0.5 shrink-0 flex-wrap">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">{t('shop.allCategories')}</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {getCategoryLabel(category)}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">{t('shop.allStatuses')}</option>
              <option value="active">{t('shop.activeFilter')}</option>
              <option value="inactive">{t('shop.inactiveFilter')}</option>
              <option value="out_of_stock">{t('shop.outOfStock')}</option>
            </select>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setFiltersExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50/80 transition-colors"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-slate-400" />
              Filtres avancés
              {hasActiveFilters && (
                <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-xs font-medium">
                  actifs
                </span>
              )}
            </span>
            <ChevronDown
              size={18}
              className={`text-slate-400 transition-transform ${filtersExpanded ? 'rotate-180' : ''}`}
            />
          </button>
          {filtersExpanded && (
            <div className="px-4 pb-4 pt-0 border-t border-slate-100">
              <FilterBar
                countryFilter={countryFilter}
                setCountryFilter={setCountryFilter}
                destinationFilter={destinationFilter}
                setDestinationFilter={setDestinationFilter}
              />
            </div>
          )}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product, index) => {
          const price = product.price ?? 0;
          const hasDiscount = product.originalPrice && product.originalPrice > price;
          const discountPercent = hasDiscount
            ? Math.round(((product.originalPrice - price) / product.originalPrice) * 100)
            : 0;

          return (
            <motion.div
              key={product._id || product.id || index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                {(() => {
                  const imgUrl = getProductImageUrl(product);
                  const src = getImageSrc(imgUrl);
                  if (!src) {
                    return (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag size={48} className="text-gray-400" />
                      </div>
                    );
                  }
                  return (
                    <>
                      <img
                        src={src}
                        alt={getProductName(product, language)}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          const placeholder = e.target.nextElementSibling;
                          if (placeholder) placeholder.style.display = 'flex';
                        }}
                      />
                      <div
                        className="w-full h-full hidden items-center justify-center absolute inset-0 bg-gray-100"
                        style={{ display: 'none' }}
                      >
                        <ShoppingBag size={48} className="text-gray-400" />
                      </div>
                    </>
                  );
                })()}
                {!product.isActive && (
                  <div className="absolute top-2 right-2 bg-gray-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                    {t('shop.inactiveBadge')}
                  </div>
                )}
                {product.stock === 0 && product.isActive && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                    {t('shop.outOfStock')}
                  </div>
                )}
                {hasDiscount && (
                  <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                    <TrendingDown size={12} />-{discountPercent}%
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 font-medium">
                    {getCategoryLabel(product.category)}
                  </span>
                  {product.rating && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Star size={14} className="text-yellow-500 fill-yellow-500" />
                      <span>{product.rating}</span>
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">{getProductName(product, language)}</h3>
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{getProductDescription(product, language)}</p>
                {product.ships && product.ships.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded flex items-center gap-1">
                      <Ship size={10} />
                      {boatConfig.shipName || t('shop.shipLabel')}
                    </span>
                  </div>
                )}
                {product.shipName && !product.ships && (
                  <div className="flex items-center gap-1 mb-2">
                    <Ship size={12} className="text-gray-500" />
                    <span className="text-xs text-gray-500">{product.shipName}</span>
                  </div>
                )}
                {product.sku && <p className="text-xs text-gray-400 mb-2">SKU: {product.sku}</p>}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {hasDiscount && (
                      <span className="text-sm text-gray-400 line-through">{product.originalPrice} €</span>
                    )}
                    <span className="text-lg font-bold text-blue-600">{price.toFixed(2)} €</span>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      product.stock > 10
                        ? 'bg-green-100 text-green-700'
                        : product.stock > 0
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {product.stock > 0 ? `${t('shop.stockShort')}: ${product.stock}` : t('shop.outOfStock')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3 pb-3 border-b border-gray-100">
                  <span>
                    {t('shop.soldLabel')}: {product.sold || 0}
                  </span>
                  {product.sold > 0 && (
                    <span>
                      {t('shop.revenueLabel')}: {(price * (product.sold || 0)).toFixed(2)} €
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditProduct(product)}
                    className="flex-1 flex items-center justify-center gap-2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit size={16} />
                    <span className="text-xs">{t('common.edit')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(product)}
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
        {filteredProducts.length === 0 && (
          <div className="col-span-full text-center py-12">
            <ShoppingBag size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('shop.noProductsFound')}</p>
          </div>
        )}
      </div>

      {/* Modal Ajouter un produit */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900">{t('shop.addProduct')}</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setImageFile(null);
                  setImagePreview(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Contenu par langue */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('shop.contentByLanguageLabel')}
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {LANG_LIST.map(({ code, label }) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setActiveLang(code)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeLang === code ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('shop.productNameRequired')}
                    </label>
                    <input
                      type="text"
                      value={newProduct.translations?.[activeLang]?.name ?? newProduct.name}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          translations: {
                            ...newProduct.translations,
                            [activeLang]: { ...newProduct.translations?.[activeLang], name: e.target.value },
                          },
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: Mug GNV Excelsior"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={newProduct.translations?.[activeLang]?.description ?? newProduct.description}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          translations: {
                            ...newProduct.translations,
                            [activeLang]: { ...newProduct.translations?.[activeLang], description: e.target.value },
                          },
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Description du produit..."
                    />
                  </div>
                </div>
              </div>

              {/* Catégorie */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('shop.categoryRequired')}</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('shop.selectCategoryPlaceholder')}</option>
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {getCategoryLabel(cat)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Prix et stock */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('shop.priceLabel')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProduct.price || ''}
                    onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('shop.originalPriceLabel')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProduct.originalPrice || ''}
                    onChange={(e) => setNewProduct({ ...newProduct, originalPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('shop.stockLabel')}</label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.stock || ''}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* SKU et Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">SKU (Référence)</label>
                  <input
                    type="text"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: GNV-MUG-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <select
                    value={newProduct.type || 'physical'}
                    onChange={(e) => setNewProduct({ ...newProduct, type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PRODUCT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Image du produit — upload obligatoire (serveur) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('shop.productImageLabel')} (uploadée sur le serveur)
                </label>
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-lg border border-gray-300"
                    />
                    <button
                      onClick={removeImage}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload size={32} className="text-gray-400 mb-2" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">{t('shop.clickToUpload')}</span> {t('shop.orDragDrop')}
                      </p>
                      <p className="text-xs text-gray-500">{t('shop.imageFormatsUpTo5MB')}</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('shop.tagsLabel')}</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('shop.addTagPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    {t('shop.addTagButton')}
                  </button>
                </div>
                {newProduct.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {newProduct.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                      >
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-blue-900">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Note et statut */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Note (0-5)</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={newProduct.rating || ''}
                    onChange={(e) => setNewProduct({ ...newProduct, rating: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.0"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newProduct.isActive}
                      onChange={(e) => setNewProduct({ ...newProduct, isActive: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">{t('shop.productActive')}</span>
                  </label>
                </div>
              </div>

              {/* Boutons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowAddModal(false);
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddProduct}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {t('shop.addProductButton')}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Modifier produit */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-gray-900">{t('shop.editProduct')}</h2>
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setEditImageFile(null);
                  setEditImagePreview(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Onglets langues */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('shop.contentByLanguageLabel')}
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {LANG_LIST.map(({ code, label }) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setEditActiveLang(code)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${editActiveLang === code ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {editActiveLang === 'fr' ? (
                  <>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('shop.productNameRequired')}
                      </label>
                      <input
                        type="text"
                        value={editingProduct.name || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('shop.description')}</label>
                      <textarea
                        rows={3}
                        value={editingProduct.description || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('shop.productName')}</label>
                      <input
                        type="text"
                        value={editingProduct.translations?.[editActiveLang]?.name || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            translations: {
                              ...editingProduct.translations,
                              [editActiveLang]: {
                                ...editingProduct.translations?.[editActiveLang],
                                name: e.target.value,
                              },
                            },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('shop.description')}</label>
                      <textarea
                        rows={3}
                        value={editingProduct.translations?.[editActiveLang]?.description || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            translations: {
                              ...editingProduct.translations,
                              [editActiveLang]: {
                                ...editingProduct.translations?.[editActiveLang],
                                description: e.target.value,
                              },
                            },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('shop.categoryRequired')}</label>
                  <select
                    value={editingProduct.category || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingProduct.price ?? ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('shop.stockLabel')}</label>
                  <input
                    type="number"
                    min="0"
                    value={editingProduct.stock ?? ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input
                    type="text"
                    value={editingProduct.sku || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={
                      PRODUCT_TYPE_OPTIONS.some((o) => o.value === editingProduct.type)
                        ? editingProduct.type
                        : 'physical'
                    }
                    onChange={(e) => setEditingProduct({ ...editingProduct, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {PRODUCT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Image : upload optionnel */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('shop.productImageLabel')}</label>
                {editImagePreview ? (
                  <div className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <img src={editImagePreview} alt="Produit" className="w-24 h-20 object-cover rounded" />
                    <div className="flex-1 text-sm text-gray-600">{editImageFile?.name || t('shop.currentImage')}</div>
                    <button
                      type="button"
                      onClick={removeEditImage}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : null}
                <label className="mt-2 flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <Upload size={20} className="text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500">
                    {editImagePreview ? t('shop.replaceImage') : t('shop.uploadImageOptional')}
                  </span>
                  <input type="file" accept="image/*" onChange={handleEditImageUpload} className="hidden" />
                </label>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingProduct.isActive !== false}
                    onChange={(e) => setEditingProduct({ ...editingProduct, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">{t('shop.productActive')}</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setEditImageFile(null);
                  setEditImagePreview(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveEditProduct}
                disabled={uploadingImage}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {uploadingImage ? t('shop.saving') : t('common.save')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Ajouter une promotion */}
      {showPromoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingPromotion ? t('shop.editPromotion') : t('shop.newPromotion')}
              </h2>
              <button onClick={closePromoModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Contenu par langue (titre + description multilingues) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('shop.contentByLanguage')} *</label>
                <p className="text-xs text-gray-500 mb-3">{t('shop.fillFrenchOtherLanguages')}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {LANG_LIST.map(({ code, label }) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setPromoActiveLang(code)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${promoActiveLang === code ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('shop.promotionTitleLabel')}{' '}
                      <span className="text-gray-400 font-normal">({promoActiveLang})</span>
                    </label>
                    <input
                      type="text"
                      value={newPromotion.translations?.[promoActiveLang]?.title ?? ''}
                      onChange={(e) =>
                        setNewPromotion({
                          ...newPromotion,
                          translations: {
                            ...newPromotion.translations,
                            [promoActiveLang]: {
                              ...newPromotion.translations?.[promoActiveLang],
                              title: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder={
                        t(`shop.promotionTitlePlaceholder_${promoActiveLang}`) ||
                        (promoActiveLang === 'fr' ? 'Ex: Réduction été 2026' : 'E.g. Summer discount 2026')
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('shop.promotionDescriptionLabel')}{' '}
                      <span className="text-gray-400 font-normal">({promoActiveLang})</span>
                    </label>
                    <textarea
                      value={newPromotion.translations?.[promoActiveLang]?.description ?? ''}
                      onChange={(e) =>
                        setNewPromotion({
                          ...newPromotion,
                          translations: {
                            ...newPromotion.translations,
                            [promoActiveLang]: {
                              ...newPromotion.translations?.[promoActiveLang],
                              description: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      rows={3}
                      placeholder={
                        t(`shop.promotionDescriptionPlaceholder_${promoActiveLang}`) ||
                        (promoActiveLang === 'fr' ? 'Description de la promotion...' : 'Promotion description...')
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Type et valeur de réduction */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('shop.reductionTypeLabel')}</label>
                  <select
                    value={newPromotion.discountType}
                    onChange={(e) => setNewPromotion({ ...newPromotion, discountType: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="percentage">{t('shop.reductionTypePercentage')}</option>
                    <option value="fixed">{t('shop.reductionTypeFixed')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shop.reductionValueLabel')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max={newPromotion.discountType === 'percentage' ? 100 : undefined}
                      step={newPromotion.discountType === 'percentage' ? 1 : 0.01}
                      value={newPromotion.discountValue || ''}
                      onChange={(e) =>
                        setNewPromotion({ ...newPromotion, discountValue: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder={newPromotion.discountType === 'percentage' ? '0' : '0.00'}
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      {newPromotion.discountType === 'percentage' ? '%' : '€'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Produits concernés */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {t('shop.affectedProductsLabel')}
                </label>
                <div className="border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                  {products.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">{t('shop.noProductsAvailable')}</p>
                  ) : (
                    <div className="space-y-2">
                      {products.map((product) => (
                        <label
                          key={product._id || product.id}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={newPromotion.productIds.includes(product._id || product.id)}
                            onChange={() => toggleProductForPromo(product._id || product.id)}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <div className="flex-1">
                            <span className="font-medium text-gray-900">{getProductName(product, language)}</span>
                            <span className="text-xs text-gray-500 ml-2">({product.price}€)</span>
                          </div>
                          {newPromotion.productIds.includes(product._id || product.id) && (
                            <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {newPromotion.productIds.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {t('shop.productsSelectedCount', { count: newPromotion.productIds.length })}
                  </p>
                )}
              </div>

              {/* Pays */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">{t('shop.affectCountriesLabel')}</label>
                <div className="border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                  {availableCountries.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">{t('shop.noCountriesAvailable')}</p>
                  ) : (
                    <div className="space-y-2">
                      {availableCountries.map((country) => (
                        <label
                          key={country.code}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={newPromotion.countries.includes(country.name)}
                            onChange={() => toggleCountryForPromo(country.name)}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <div className="flex-1 flex items-center gap-2">
                            <Globe size={16} className="text-gray-500" />
                            <span className="font-medium text-gray-900">{country.name}</span>
                            <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded">
                              {country.code}
                            </span>
                          </div>
                          {newPromotion.countries.includes(country.name) && (
                            <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {newPromotion.countries.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {t('shop.countriesSelectedCount', { count: newPromotion.countries.length })}
                  </p>
                )}
              </div>

              {/* Dates de validité */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('shop.validFromLabel')}</label>
                  <input
                    type="date"
                    value={newPromotion.validFrom}
                    onChange={(e) => setNewPromotion({ ...newPromotion, validFrom: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('shop.validUntilLabel')}</label>
                  <input
                    type="date"
                    value={newPromotion.validUntil}
                    onChange={(e) => setNewPromotion({ ...newPromotion, validUntil: e.target.value })}
                    min={newPromotion.validFrom}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Statut */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPromotion.isActive}
                    onChange={(e) => setNewPromotion({ ...newPromotion, isActive: e.target.checked })}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{t('shop.promotionActiveLabel')}</span>
                </label>
              </div>

              {/* Boutons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={closePromoModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={editingPromotion ? handleUpdatePromotion : handleAddPromotion}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  {editingPromotion ? t('shop.savePromotionChanges') : t('shop.createPromotion')}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Shop;
