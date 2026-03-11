import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Utensils, 
  Plus, 
  Clock,
  Star,
  MapPin,
  X,
  Save,
  Upload,
  DollarSign,
  Ship,
  Globe,
  Pencil,
  Copy,
  Trash2,
  MoreVertical,
  Award
} from 'lucide-react';
import { apiService } from '../services/apiService';
import toast from 'react-hot-toast';
import { LANG_LIST, emptyTranslationsAll, emptyMenuTranslations, emptyPromotionTranslations } from '../utils/i18n';
import { useLanguage } from '../contexts/LanguageContext';
import { useBoatConfig } from '../contexts/BoatConfigContext';

/** URL d’image : si relative (/uploads/...), on préfixe par l’origine pour que le proxy du dashboard serve l’image */
const DEFAULT_RESTAURANT_IMAGE = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop';

function getImageSrc(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return origin ? `${origin}${url.startsWith('/') ? '' : '/'}${url}` : url;
}

function getRestaurantImageSrc(r) {
  const url = r?.image?.trim();
  return getImageSrc(url) || DEFAULT_RESTAURANT_IMAGE;
}

/** Type de restaurant : valeur API (fr) → libellés par langue (pour affichage et payload) */
const RESTAURANT_TYPE_LABELS = {
  'Restaurant à la carte':     { fr: 'Restaurant à la carte',     en: 'À la carte restaurant',  es: 'Restaurante a la carta',  it: 'Ristorante à la carte',  de: 'À-la-carte-Restaurant',   ar: 'مطعم حسب الطلب' },
  'Restaurant Self-Service':   { fr: 'Restaurant Self-Service',   en: 'Self-service restaurant', es: 'Restaurante autoservicio', it: 'Ristorante self-service', de: 'Selbstbedienungsrestaurant', ar: 'مطعم self-service' },
  'Café & Snacks':             { fr: 'Café & Snacks',             en: 'Café & Snacks',           es: 'Café y snacks',           it: 'Caffè e snack',          de: 'Café & Snacks',           ar: 'مقهى ووجبات خفيفة' },
  'Pizzeria saisonnière':      { fr: 'Pizzeria saisonnière',     en: 'Seasonal pizzeria',       es: 'Pizzería de temporada',   it: 'Pizzeria stagionale',    de: 'Saisonale Pizzeria',      ar: 'بيتزا موسمية' },
  'Steakhouse':                { fr: 'Steakhouse',               en: 'Steakhouse',              es: 'Steakhouse',              it: 'Steakhouse',             de: 'Steakhouse',              ar: 'ستيك هاوس' },
  'Room Service':              { fr: 'Room Service',              en: 'Room service',            es: 'Servicio de habitaciones', it: 'Servizio in camera',    de: 'Zimmerservice',           ar: 'خدمة الغرف' }
};

/** Catégorie de plat (menu) : clé → libellés par langue */
const MENU_CATEGORY_LABELS = {
  appetizer: { fr: 'Entrée',        en: 'Starter',        es: 'Entrante',      it: 'Antipasto',   de: 'Vorspeise',    ar: 'مقبلات' },
  main:       { fr: 'Plat principal', en: 'Main course',   es: 'Plato principal', it: 'Piatto principale', de: 'Hauptgericht', ar: 'الطبق الرئيسي' },
  dessert:    { fr: 'Dessert',       en: 'Dessert',       es: 'Postre',        it: 'Dolce',       de: 'Nachtisch',    ar: 'حلوى' },
  beverage:   { fr: 'Boisson',      en: 'Beverage',      es: 'Bebida',        it: 'Bevanda',     de: 'Getränk',      ar: 'مشروب' },
  wine:       { fr: 'Vin',         en: 'Wine',          es: 'Vino',          it: 'Vino',        de: 'Wein',         ar: 'نبيذ' },
  cocktail:   { fr: 'Cocktail',    en: 'Cocktail',      es: 'Cóctel',        it: 'Cocktail',    de: 'Cocktail',     ar: 'كوكتيل' },
  other:      { fr: 'Autre',       en: 'Other',         es: 'Otro',          it: 'Altro',       de: 'Sonstige',     ar: 'آخر' }
};

/** Catégorie restaurant (french, fastfood, etc.) : clé → libellés par langue (contenu par langue) */
const RESTAURANT_CATEGORY_LABELS = {
  french:   { fr: 'Français',     en: 'French',       es: 'Francés',      it: 'Francese',    de: 'Französisch',   ar: 'فرنسي' },
  fastfood: { fr: 'Fast-food',   en: 'Fast food',    es: 'Comida rápida', it: 'Fast food',   de: 'Fastfood',      ar: 'وجبات سريعة' },
  dessert:  { fr: 'Dessert',     en: 'Dessert',      es: 'Postres',      it: 'Dolce',       de: 'Dessert',       ar: 'حلويات' },
  seafood:  { fr: 'Fruits de mer', en: 'Seafood',     es: 'Mariscos',     it: 'Frutti di mare', de: 'Meeresfrüchte', ar: 'مأكولات بحرية' }
};

/** Libellés du formulaire restaurant par langue (Type de restaurant, Sélectionner..., etc.) */
const RESTAURANT_FORM_LABELS = {
  fr: { restaurantTypeLabel: 'Type de restaurant', type: 'Type', shipLabel: 'Bateau', selectPlaceholder: 'Sélectionner...', selectShipPlaceholder: 'Sélectionner un bateau...', locationLabel: 'Localisation', locationPlaceholder: 'Ex : Pont 7, Niveau 2', priceRangeLabel: 'Fourchette de prix', priceRangeBudget: '€ Économique', priceRangeModerate: '€€ Modéré', priceRangeHigh: '€€€ Élevé', priceRangeVeryHigh: '€€€€ Très élevé', openingHoursLabel: "Heures d'ouverture", openingHoursPlaceholder: 'Ex : 08:00 - 22:00' },
  en: { restaurantTypeLabel: 'Restaurant type', type: 'Type', shipLabel: 'Ship', selectPlaceholder: 'Select...', selectShipPlaceholder: 'Select a ship...', locationLabel: 'Location', locationPlaceholder: 'E.g. Deck 7, Level 2', priceRangeLabel: 'Price range', priceRangeBudget: '€ Budget', priceRangeModerate: '€€ Moderate', priceRangeHigh: '€€€ High', priceRangeVeryHigh: '€€€€ Very high', openingHoursLabel: 'Opening hours', openingHoursPlaceholder: 'E.g. 08:00 - 22:00' },
  es: { restaurantTypeLabel: 'Tipo de restaurante', type: 'Tipo', shipLabel: 'Barco', selectPlaceholder: 'Seleccionar...', selectShipPlaceholder: 'Seleccione un barco...', locationLabel: 'Ubicación', locationPlaceholder: 'Ej: Cubierta 7, Nivel 2', priceRangeLabel: 'Rango de precios', priceRangeBudget: '€ Económico', priceRangeModerate: '€€ Moderado', priceRangeHigh: '€€€ Alto', priceRangeVeryHigh: '€€€€ Muy alto', openingHoursLabel: 'Horario de apertura', openingHoursPlaceholder: 'Ej: 08:00 - 22:00' },
  it: { restaurantTypeLabel: 'Tipo di ristorante', type: 'Tipo', shipLabel: 'Nave', selectPlaceholder: 'Seleziona...', selectShipPlaceholder: 'Seleziona una nave...', locationLabel: 'Posizione', locationPlaceholder: 'Es: Ponte 7, Livello 2', priceRangeLabel: 'Fascia di prezzo', priceRangeBudget: '€ Economico', priceRangeModerate: '€€ Moderato', priceRangeHigh: '€€€ Alto', priceRangeVeryHigh: '€€€€ Molto alto', openingHoursLabel: 'Orari di apertura', openingHoursPlaceholder: 'Es: 08:00 - 22:00' },
  de: { restaurantTypeLabel: 'Restauranttyp', type: 'Typ', shipLabel: 'Schiff', selectPlaceholder: 'Auswählen...', selectShipPlaceholder: 'Schiff auswählen...', locationLabel: 'Standort', locationPlaceholder: 'z. B. Deck 7, Ebene 2', priceRangeLabel: 'Preisklasse', priceRangeBudget: '€ Günstig', priceRangeModerate: '€€ Mittel', priceRangeHigh: '€€€ Gehoben', priceRangeVeryHigh: '€€€€ Sehr gehoben', openingHoursLabel: 'Öffnungszeiten', openingHoursPlaceholder: 'z. B. 08:00 - 22:00' },
  ar: { restaurantTypeLabel: 'نوع المطعم', type: 'النوع', shipLabel: 'السفينة', selectPlaceholder: 'اختر...', selectShipPlaceholder: 'اختر سفينة...', locationLabel: 'الموقع', locationPlaceholder: 'مثال: السطح 7، المستوى 2', priceRangeLabel: 'نطاق السعر', priceRangeBudget: '€ اقتصادي', priceRangeModerate: '€€ متوسط', priceRangeHigh: '€€€ مرتفع', priceRangeVeryHigh: '€€€€ مرتفع جداً', openingHoursLabel: 'ساعات العمل', openingHoursPlaceholder: 'مثال: 08:00 - 22:00' }
};

function getFormLabel(lang, key) {
  return RESTAURANT_FORM_LABELS[lang]?.[key] ?? RESTAURANT_FORM_LABELS.fr[key] ?? key;
}

/** Transforme un restaurant API en état formulaire (pour édition) */
function restaurantToFormState(r) {
  const translations = {};
  LANG_LIST.forEach(({ code }) => {
    const base = r.translations?.[code];
    const fr = r.translations?.fr;
    translations[code] = {
      name: base?.name ?? (code === 'fr' ? (r.name ?? '') : (fr?.name ?? '')),
      description: base?.description ?? (code === 'fr' ? (r.description ?? '') : (fr?.description ?? '')),
      type: base?.type ?? (RESTAURANT_TYPE_LABELS[r.type]?.[code] || (code === 'fr' ? r.type : (fr?.type || r.type || ''))),
      category: base?.category ?? (RESTAURANT_CATEGORY_LABELS[r.category]?.[code] || (code === 'fr' ? (r.category ?? '') : (fr?.category || r.category || ''))),
      specialties: Array.isArray(base?.specialties) ? [...base.specialties] : (code === 'fr' ? (Array.isArray(r.specialties) ? [...r.specialties] : []) : [])
    };
  });
  const menu = (r.menu || []).map((item, idx) => {
    const translations = emptyMenuTranslations();
    LANG_LIST.forEach(({ code }) => {
      const menuLang = r.translations?.[code]?.menu;
      const entry = Array.isArray(menuLang) && menuLang[idx] ? menuLang[idx] : null;
      translations[code] = {
        name: (entry && entry.name) ? entry.name : (item.name ?? ''),
        description: (entry && entry.description) ? entry.description : (item.description ?? '')
      };
    });
    return {
      ...item,
      id: item.id ?? idx + 1,
      name: item.name ?? '',
      description: item.description ?? '',
      price: item.price ?? 0,
      category: item.category ?? 'main',
      isPopular: item.isPopular ?? false,
      image: item.image ?? '',
      translations
    };
  });
  const promotions = (r.promotions || []).map((promo, idx) => {
    const promoTranslations = emptyPromotionTranslations();
    LANG_LIST.forEach(({ code }) => {
      const promoLang = r.translations?.[code]?.promotions;
      const entry = Array.isArray(promoLang) && promoLang[idx] ? promoLang[idx] : null;
      promoTranslations[code] = {
        title: (entry && entry.title) ? entry.title : (promo.title ?? ''),
        description: (entry && entry.description) ? entry.description : (promo.description ?? '')
      };
    });
    return {
      ...promo,
      translations: promo.translations && typeof promo.translations === 'object' ? { ...emptyPromotionTranslations(), ...promo.translations } : promoTranslations
    };
  });
  return {
    name: r.name ?? '',
    type: r.type ?? '',
    category: r.category ?? 'french',
    description: r.description ?? '',
    location: r.location ?? '',
    priceRange: r.priceRange ?? '€€',
    openingHours: r.openingHours ?? '',
    rating: r.rating ?? 4.5,
    specialties: Array.isArray(r.specialties) ? [...r.specialties] : [],
    menu,
    promotions,
    isOpen: r.isOpen !== false,
    shipId: r.shipId ?? '',
    shipName: r.shipName ?? '',
    translations
  };
}

const Restaurants = () => {
  const { t } = useLanguage();
  const { boatConfig } = useBoatConfig();
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [activeLang, setActiveLang] = useState('fr');
  const [newRestaurant, setNewRestaurant] = useState({
    name: '',
    type: '',
    category: 'french',
    description: '',
    location: '',
    priceRange: '€€',
    openingHours: '',
    rating: 4.5,
    specialties: [],
    menu: [],
    promotions: [],
    isOpen: true,
    shipId: '',
    shipName: '',
    translations: emptyTranslationsAll()
  });

  const [newSpecialty, setNewSpecialty] = useState('');
  const [newMenuItem, setNewMenuItem] = useState({
    name: '',
    description: '',
    price: '',
    image: '',
    category: 'main',
    isPopular: false,
    translations: emptyMenuTranslations()
  });
  const [menuItemImageFile, setMenuItemImageFile] = useState(null);
  const [menuItemImagePreview, setMenuItemImagePreview] = useState(null);
  const [uploadingMenuItemImage, setUploadingMenuItemImage] = useState(false);
  const [editingMenuItemId, setEditingMenuItemId] = useState(null);

  const [newPromotion, setNewPromotion] = useState({
    title: '',
    description: '',
    price: '',
    originalPrice: '',
    discount: '',
    validUntil: '',
    translations: emptyPromotionTranslations()
  });

  // Charger la liste des restaurants au montage
  useEffect(() => {
    const loadRestaurants = async () => {
      try {
        setRestaurantsLoading(true);
        const res = await apiService.getRestaurants();
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
        setRestaurants(list);
      } catch (err) {
        console.error('Erreur chargement restaurants:', err);
        toast.error(err.response?.data?.message || 'Impossible de charger les restaurants');
        setRestaurants([]);
      } finally {
        setRestaurantsLoading(false);
      }
    };
    loadRestaurants();
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Veuillez sélectionner un fichier image');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Le fichier est trop volumineux (max 5MB)');
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

  const handleMenuItemImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Veuillez sélectionner un fichier image');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Le fichier est trop volumineux (max 5MB)');
        return;
      }
      setMenuItemImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMenuItemImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeMenuItemImage = () => {
    setMenuItemImageFile(null);
    setMenuItemImagePreview(null);
  };

  const addSpecialty = () => {
    if (!newSpecialty.trim()) return;
    const list = newRestaurant.translations?.[activeLang]?.specialties ?? newRestaurant.specialties ?? [];
    if (list.includes(newSpecialty.trim())) return;
    setNewRestaurant({
      ...newRestaurant,
      translations: {
        ...newRestaurant.translations,
        [activeLang]: {
          ...newRestaurant.translations?.[activeLang],
          specialties: [...list, newSpecialty.trim()]
        }
      }
    });
    setNewSpecialty('');
  };

  const removeSpecialty = (specialty) => {
    const list = newRestaurant.translations?.[activeLang]?.specialties ?? newRestaurant.specialties ?? [];
    setNewRestaurant({
      ...newRestaurant,
      translations: {
        ...newRestaurant.translations,
        [activeLang]: {
          ...newRestaurant.translations?.[activeLang],
          specialties: list.filter(s => s !== specialty)
        }
      }
    });
  };

  const addMenuItem = async () => {
    const name = newMenuItem.translations?.fr?.name || newMenuItem.name || '';
    if (!name.trim() || !newMenuItem.price) {
      toast.error('Veuillez remplir le nom (au moins en français) et le prix');
      return;
    }
    let imageUrl = newMenuItem.image || '';
    if (menuItemImageFile) {
      try {
        setUploadingMenuItemImage(true);
        const up = await apiService.uploadImage(menuItemImageFile);
        // Préférer le chemin relatif pour que l'image s'affiche correctement (même origine)
        imageUrl = up?.image?.path || up?.image?.url || up?.data?.image?.path || up?.data?.image?.url || imageUrl;
      } catch (err) {
        toast.error('Erreur lors de l\'upload de l\'image du plat');
        setUploadingMenuItemImage(false);
        return;
      } finally {
        setUploadingMenuItemImage(false);
      }
    }
    const menuItem = {
      ...newMenuItem,
      id: editingMenuItemId ?? Date.now(),
      price: parseFloat(newMenuItem.price),
      category: newMenuItem.category || 'main',
      image: imageUrl || undefined,
      name: newMenuItem.translations?.fr?.name || newMenuItem.name || '',
      description: newMenuItem.translations?.fr?.description ?? newMenuItem.description ?? '',
      translations: newMenuItem.translations || emptyMenuTranslations()
    };
    if (editingMenuItemId) {
      setNewRestaurant({
        ...newRestaurant,
        menu: newRestaurant.menu.map((item) => (item.id === editingMenuItemId ? menuItem : item))
      });
      toast.success('Plat modifié');
    } else {
      setNewRestaurant({
        ...newRestaurant,
        menu: [...newRestaurant.menu, menuItem]
      });
      toast.success('Plat ajouté au menu');
    }
    setNewMenuItem({
      name: '',
      description: '',
      price: '',
      image: '',
      category: 'main',
      isPopular: false,
      translations: emptyMenuTranslations()
    });
    setMenuItemImageFile(null);
    setMenuItemImagePreview(null);
    setEditingMenuItemId(null);
  };

  const openEditMenuItem = (item) => {
    setEditingMenuItemId(item.id);
    const trans = item.translations || emptyMenuTranslations();
    LANG_LIST.forEach(({ code }) => {
      if (!trans[code]) trans[code] = { name: '', description: '' };
      if (!trans[code].name && item.name) trans[code].name = item.name;
      if (!trans[code].description && item.description) trans[code].description = item.description;
    });
    setNewMenuItem({
      name: trans.fr?.name ?? item.name ?? '',
      description: trans.fr?.description ?? item.description ?? '',
      price: item.price ?? '',
      image: item.image ?? '',
      category: item.category ?? 'main',
      isPopular: item.isPopular ?? false,
      translations: trans
    });
    setMenuItemImagePreview(item.image || null);
    setMenuItemImageFile(null);
  };

  const cancelEditMenuItem = () => {
    setEditingMenuItemId(null);
    setNewMenuItem({
      name: '',
      description: '',
      price: '',
      image: '',
      category: 'main',
      isPopular: false,
      translations: emptyMenuTranslations()
    });
    setMenuItemImageFile(null);
    setMenuItemImagePreview(null);
  };

  const removeMenuItem = (id) => {
    setNewRestaurant({
      ...newRestaurant,
      menu: newRestaurant.menu.filter(item => item.id !== id)
    });
  };

  const nextPromoId = () => {
    const ids = (newRestaurant.promotions || []).map(p => p.id).filter(n => typeof n === 'number');
    return ids.length ? Math.max(...ids) + 1 : 1;
  };

  const addPromotion = () => {
    const title = (newPromotion.translations?.fr?.title ?? newPromotion.title ?? '').trim();
    const description = (newPromotion.translations?.fr?.description ?? newPromotion.description ?? '').trim();
    const price = parseFloat(newPromotion.price);
    let originalPrice = parseFloat(newPromotion.originalPrice);
    let discount = parseFloat(newPromotion.discount);
    const validUntil = newPromotion.validUntil ? new Date(newPromotion.validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (!title || !description || isNaN(price) || price < 0) {
      toast.error('Veuillez remplir au moins le titre, la description et le prix de la promotion');
      return;
    }
    if (isNaN(originalPrice) || originalPrice < 0) originalPrice = price;
    if (isNaN(discount) || discount < 0) discount = originalPrice > 0 ? Math.round((1 - price / originalPrice) * 100) : 0;
    const promo = {
      id: nextPromoId(),
      title,
      description,
      price,
      originalPrice: isNaN(originalPrice) ? price : originalPrice,
      discount: isNaN(discount) ? 0 : discount,
      validUntil: validUntil.toISOString ? validUntil.toISOString() : validUntil,
      translations: newPromotion.translations || emptyPromotionTranslations()
    };
    setNewRestaurant({
      ...newRestaurant,
      promotions: [...(newRestaurant.promotions || []), promo]
    });
    setNewPromotion({ title: '', description: '', price: '', originalPrice: '', discount: '', validUntil: '', translations: emptyPromotionTranslations() });
    toast.success('Promotion ajoutée');
  };

  const removePromotion = (id) => {
    setNewRestaurant({
      ...newRestaurant,
      promotions: (newRestaurant.promotions || []).filter(p => p.id !== id)
    });
  };

  const handleAddRestaurant = async () => {
    const frName = (newRestaurant.translations?.fr?.name ?? newRestaurant.name)?.trim();
    const frDesc = (newRestaurant.translations?.fr?.description ?? newRestaurant.description)?.trim() ?? '';
    if (!frName || !(newRestaurant.translations?.fr?.type ?? newRestaurant.type)?.trim() || !frDesc) {
      toast.error('Veuillez remplir au moins le nom, le type de restaurant et la description (français)');
      return;
    }

    if (!newRestaurant.shipName && !boatConfig.shipName) {
      toast.error('Veuillez sélectionner un bateau');
      return;
    }

    try {
      let imageUrl = imagePreview || '';
      if (imageFile) {
        const up = await apiService.uploadImage(imageFile);
        imageUrl = up?.image?.url || up?.image?.path || up?.data?.image?.url || up?.data?.image?.path || imageUrl;
      }
      if (!imageUrl) {
        imageUrl = DEFAULT_RESTAURANT_IMAGE;
      }

      const translations = {};
      LANG_LIST.forEach(({ code }) => {
        const t = newRestaurant.translations?.[code];
        if (code === 'fr') {
          translations.fr = { name: frName, description: frDesc };
        } else if (t && (t.name?.trim() || t.description?.trim())) {
          translations[code] = { name: t.name || '', description: t.description || '' };
        } else {
          translations[code] = { name: frName, description: frDesc };
        }
        translations[code].specialties = newRestaurant.translations?.[code]?.specialties ?? newRestaurant.translations?.fr?.specialties ?? newRestaurant.specialties ?? [];
        translations[code].type = (newRestaurant.translations?.[code]?.type ?? newRestaurant.translations?.fr?.type ?? newRestaurant.type ?? '').trim() || (newRestaurant.translations?.fr?.type ?? newRestaurant.type ?? '');
        translations[code].category = (newRestaurant.translations?.[code]?.category ?? newRestaurant.translations?.fr?.category ?? newRestaurant.category ?? '').trim() || (newRestaurant.translations?.fr?.category ?? newRestaurant.category ?? '');
        translations[code].menu = newRestaurant.menu.map((item) => ({
          name: item.translations?.[code]?.name ?? item.translations?.fr?.name ?? item.name ?? '',
          description: item.translations?.[code]?.description ?? item.translations?.fr?.description ?? item.description ?? ''
        }));
        translations[code].promotions = (newRestaurant.promotions || []).map((p) => ({
          title: p.translations?.[code]?.title ?? p.translations?.fr?.title ?? p.title ?? '',
          description: p.translations?.[code]?.description ?? p.translations?.fr?.description ?? p.description ?? ''
        }));
      });

      const payload = {
        name: frName,
        type: (newRestaurant.translations?.fr?.type ?? newRestaurant.type ?? '').trim() || newRestaurant.type,
        category: (newRestaurant.translations?.fr?.category ?? newRestaurant.category ?? '').trim() || newRestaurant.category || 'french',
        description: frDesc,
        location: newRestaurant.location || '',
        priceRange: newRestaurant.priceRange || '€€',
        openingHours: newRestaurant.openingHours || '',
        rating: newRestaurant.rating ?? 4.5,
        specialties: newRestaurant.translations?.fr?.specialties ?? newRestaurant.specialties ?? [],
        menu: newRestaurant.menu.map((item, idx) => ({
          id: idx + 1,
          name: item.translations?.fr?.name ?? item.name,
          description: item.translations?.fr?.description ?? item.description ?? '',
          price: item.price,
          category: item.category || 'main',
          isPopular: item.isPopular || false,
          allergens: item.allergens || [],
          image: item.image || undefined
        })),
        promotions: newRestaurant.promotions || [],
        isOpen: newRestaurant.isOpen !== false,
        shipId: newRestaurant.shipId || '1',
        shipName: newRestaurant.shipName || boatConfig.shipName || undefined,
        image: imageUrl,
        translations: Object.keys(translations).length ? translations : undefined
      };

      const res = await apiService.createRestaurant(payload);
      const created = res.data?.restaurant || { ...payload, _id: res.data?._id };
      setRestaurants((prev) => [...(Array.isArray(prev) ? prev : []), created]);
      toast.success('Restaurant ajouté avec succès');
      closeModal();
    } catch (error) {
      console.error('Erreur lors de l\'ajout du restaurant:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de l\'ajout du restaurant');
    }
  };

  const openEditModal = async (r) => {
    setActionMenuOpen(null);
    try {
      const res = await apiService.getRestaurant(r._id);
      const data = res.data ?? res;
      setNewRestaurant(restaurantToFormState(data));
      setImagePreview(data.image || null);
      setImageFile(null);
      setNewSpecialty('');
      setMenuItemImageFile(null);
      setMenuItemImagePreview(null);
      setActiveLang('fr');
      setEditingId(r._id);
      setShowAddModal(true);
    } catch (err) {
      console.error('Erreur chargement restaurant:', err);
      toast.error('Impossible de charger le restaurant');
    }
  };

  const handleUpdateRestaurant = async () => {
    if (!editingId) return;
    const frName = (newRestaurant.translations?.fr?.name ?? newRestaurant.name)?.trim();
    const frDesc = (newRestaurant.translations?.fr?.description ?? newRestaurant.description)?.trim() ?? '';
    if (!frName || !(newRestaurant.translations?.fr?.type ?? newRestaurant.type)?.trim() || !frDesc) {
      toast.error('Veuillez remplir au moins le nom, le type de restaurant et la description (français)');
      return;
    }
    if (!newRestaurant.shipName && !boatConfig.shipName) {
      toast.error('Veuillez sélectionner un bateau');
      return;
    }
    try {
      let imageUrl = imagePreview || '';
      if (imageFile) {
        const up = await apiService.uploadImage(imageFile);
        imageUrl = up?.image?.url || up?.image?.path || up?.data?.image?.url || up?.data?.image?.path || imageUrl;
      }
      if (!imageUrl && editingId) {
        const current = restaurants.find((r) => r._id === editingId);
        if (current?.image) imageUrl = current.image;
      }
      if (!imageUrl) {
        imageUrl = DEFAULT_RESTAURANT_IMAGE;
      }
      const translations = {};
      LANG_LIST.forEach(({ code }) => {
        const t = newRestaurant.translations?.[code];
        if (code === 'fr') {
          translations.fr = { name: frName, description: frDesc };
        } else if (t && (t.name?.trim() || t.description?.trim())) {
          translations[code] = { name: t.name || '', description: t.description || '' };
        } else {
          translations[code] = { name: frName, description: frDesc };
        }
        translations[code].specialties = newRestaurant.translations?.[code]?.specialties ?? newRestaurant.translations?.fr?.specialties ?? newRestaurant.specialties ?? [];
        translations[code].type = (newRestaurant.translations?.[code]?.type ?? newRestaurant.translations?.fr?.type ?? newRestaurant.type ?? '').trim() || (newRestaurant.translations?.fr?.type ?? newRestaurant.type ?? '');
        translations[code].category = (newRestaurant.translations?.[code]?.category ?? newRestaurant.translations?.fr?.category ?? newRestaurant.category ?? '').trim() || (newRestaurant.translations?.fr?.category ?? newRestaurant.category ?? '');
        translations[code].menu = newRestaurant.menu.map((item) => ({
          name: item.translations?.[code]?.name ?? item.translations?.fr?.name ?? item.name ?? '',
          description: item.translations?.[code]?.description ?? item.translations?.fr?.description ?? item.description ?? ''
        }));
        translations[code].promotions = (newRestaurant.promotions || []).map((p) => ({
          title: p.translations?.[code]?.title ?? p.translations?.fr?.title ?? p.title ?? '',
          description: p.translations?.[code]?.description ?? p.translations?.fr?.description ?? p.description ?? ''
        }));
      });
      const payload = {
        name: frName,
        type: (newRestaurant.translations?.fr?.type ?? newRestaurant.type ?? '').trim() || newRestaurant.type,
        category: (newRestaurant.translations?.fr?.category ?? newRestaurant.category ?? '').trim() || newRestaurant.category || 'french',
        description: frDesc,
        location: newRestaurant.location || '',
        priceRange: newRestaurant.priceRange || '€€',
        openingHours: newRestaurant.openingHours || '',
        rating: newRestaurant.rating ?? 4.5,
        specialties: newRestaurant.translations?.fr?.specialties ?? newRestaurant.specialties ?? [],
        menu: newRestaurant.menu.map((item, idx) => ({
          id: idx + 1,
          name: item.translations?.fr?.name ?? item.name,
          description: item.translations?.fr?.description ?? item.description ?? '',
          price: item.price,
          category: item.category || 'main',
          isPopular: item.isPopular || false,
          allergens: item.allergens || [],
          image: item.image || undefined
        })),
        promotions: newRestaurant.promotions || [],
        isOpen: newRestaurant.isOpen !== false,
        shipId: newRestaurant.shipId || '1',
        shipName: newRestaurant.shipName || boatConfig.shipName || undefined,
        image: imageUrl || undefined,
        translations: Object.keys(translations).length ? translations : undefined
      };
      const res = await apiService.updateRestaurant(editingId, payload);
      const updated = res.data?.restaurant ?? { ...payload, _id: editingId };
      setRestaurants((prev) => prev.map((r) => (r._id === editingId ? updated : r)));
      setShowAddModal(false);
      setEditingId(null);
      setImageFile(null);
      setImagePreview(null);
      toast.success('Restaurant mis à jour');
    } catch (error) {
      console.error('Erreur mise à jour restaurant:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour');
    }
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

  const closeModal = () => {
    setShowAddModal(false);
    setEditingId(null);
    setEditingMenuItemId(null);
    setImageFile(null);
    setImagePreview(null);
    setNewSpecialty('');
    setNewMenuItem({ name: '', description: '', price: '', image: '', category: 'main', isPopular: false });
    setMenuItemImageFile(null);
    setMenuItemImagePreview(null);
    setNewPromotion({ title: '', description: '', price: '', originalPrice: '', discount: '', validUntil: '', translations: emptyPromotionTranslations() });
    setActiveLang('fr');
    setNewRestaurant({
      name: '',
      type: '',
      category: 'french',
      description: '',
      location: '',
      priceRange: '€€',
      openingHours: '',
      rating: 4.5,
      specialties: [],
      menu: [],
      promotions: [],
      isOpen: true,
      shipId: '1',
      shipName: boatConfig.shipName || '',
      translations: emptyTranslationsAll()
    });
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* En-tête compact */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">{t('restaurants.title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {restaurantsLoading ? t('common.loading') : t('restaurants.restaurantsCount', { count: restaurants.length })}
          </p>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setEditingId(null);
            setImageFile(null);
            setImagePreview(null);
            setNewSpecialty('');
            setNewMenuItem({ name: '', description: '', price: '', image: '', category: 'main', isPopular: false });
            setMenuItemImageFile(null);
            setMenuItemImagePreview(null);
            setEditingMenuItemId(null);
            setNewPromotion({ title: '', description: '', price: '', originalPrice: '', discount: '', validUntil: '', translations: emptyPromotionTranslations() });
            setActiveLang('fr');
            setNewRestaurant({
              name: '', type: '', category: 'french', description: '', location: '', priceRange: '€€', openingHours: '', rating: 4.5,
              specialties: [], menu: [], promotions: [], isOpen: true, shipId: '1', shipName: boatConfig.shipName || '', translations: emptyTranslationsAll()
            });
            setShowAddModal(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors shrink-0"
        >
          <Plus size={18} />
          {t('restaurants.addRestaurant')}
        </motion.button>
      </div>

      {/* Module Promotions — compact */}
      {!restaurantsLoading && restaurants.length > 0 && (() => {
        const allPromotions = restaurants.flatMap((r) =>
          (Array.isArray(r.promotions) ? r.promotions : []).map((promo) => ({
            ...promo,
            restaurantId: r._id,
            restaurantName: r.name,
            restaurant: r
          }))
        );
        return allPromotions.length > 0 ? (
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
                <Award size={18} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-800">{t('shop.promotions')}</h2>
                <p className="text-xs text-slate-500">{t('restaurants.promotionsCount', { count: allPromotions.length })}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {allPromotions.map((promo) => (
                <div
                  key={`${promo.restaurantId}-${promo.id ?? promo.title}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-amber-50/80 border border-amber-100 gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-amber-700 uppercase tracking-wide">{promo.restaurantName}</p>
                    <p className="font-medium text-slate-800 truncate text-sm mt-0.5">{promo.title}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      <span className="font-semibold text-amber-600">{promo.price}€</span>
                      {promo.originalPrice != null && <span className="ml-1 line-through text-slate-400">{promo.originalPrice}€</span>}
                      {promo.discount != null && <span className="ml-1 text-amber-600">-{promo.discount}%</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditModal(promo.restaurant)}
                    className="shrink-0 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
                  >
                    {t('common.edit')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200">
                <Award size={18} className="text-slate-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-800">{t('shop.promotions')}</h2>
                <p className="text-xs text-slate-500">{t('restaurants.noPromotionsHint')}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Liste des restaurants */}
      {restaurantsLoading ? (
        <div className="flex items-center justify-center min-h-[280px] rounded-xl bg-white border border-slate-200/80">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-500 border-t-transparent" />
            <p className="text-sm text-slate-500">Chargement...</p>
          </div>
        </div>
      ) : restaurants.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
          <div className="rounded-2xl bg-slate-100 p-6 inline-flex mb-4">
            <Utensils size={40} className="text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">{t('restaurants.noRestaurants')}</p>
          <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">{t('restaurants.noRestaurantsHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {restaurants.map((r) => (
            <motion.div
              key={r._id || r.id}
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
                      aria-label="Actions"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {actionMenuOpen === r._id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setActionMenuOpen(null)} aria-hidden="true" />
                        <div className="absolute left-0 top-full mt-1 py-1 min-w-[160px] bg-white rounded-xl border border-slate-200 shadow-lg z-20">
                          <button type="button" onClick={() => openEditModal(r)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-amber-50 hover:text-amber-800 transition-colors text-sm">
                            <Pencil size={14} />
                            {t('common.edit')}
                          </button>
                          <button type="button" onClick={() => handleDuplicateRestaurant(r)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-amber-50 hover:text-amber-800 transition-colors text-sm">
                            <Copy size={14} />
                            {t('common.duplicate')}
                          </button>
                          <button type="button" onClick={() => handleDeleteRestaurant(r)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50 transition-colors text-sm">
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
                      <span className="ml-1 text-amber-600">· {r.promotions.length} {t('restaurants.promos')}</span>
                    )}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal Ajouter / Modifier Restaurant */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
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
            {/* Header */}
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
              <button type="button" onClick={closeModal} className="p-2.5 hover:bg-white/80 rounded-xl transition-colors text-gray-500 hover:text-gray-700" aria-label={t('common.close')}>
                <X size={22} />
              </button>
            </div>

            {/* Form - scrollable */}
            <div className="p-6 space-y-8 overflow-y-auto flex-1">
              {/* Section : Contenu multilingue */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                  <Globe size={16} className="text-amber-600" />
                  {t('restaurants.contentByLanguage')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {LANG_LIST.map(({ code, label }) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setActiveLang(code)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeLang === code ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} ${code === 'fr' ? 'ring-1 ring-amber-200' : ''}`}
                    >
                      {label}
                      {code === 'fr' && <span className="ml-1 text-xs opacity-80">*</span>}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-4 p-4 bg-gray-50/80 rounded-xl border border-gray-100">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('restaurants.restaurantName')} <span className="text-amber-600">*</span>
                      <span className="text-gray-400 font-normal ml-1">({activeLang})</span>
                    </label>
                    <input
                      type="text"
                      value={newRestaurant.translations?.[activeLang]?.name ?? newRestaurant.name}
                      onChange={(e) => setNewRestaurant({
                        ...newRestaurant,
                        translations: {
                          ...newRestaurant.translations,
                          [activeLang]: { ...newRestaurant.translations?.[activeLang], name: e.target.value }
                        }
                      })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      placeholder={t('restaurants.namePlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('restaurants.description')} <span className="text-amber-600">*</span>
                      <span className="text-gray-400 font-normal ml-1">({activeLang})</span>
                    </label>
                    <textarea
                      value={newRestaurant.translations?.[activeLang]?.description ?? newRestaurant.description}
                      onChange={(e) => setNewRestaurant({
                        ...newRestaurant,
                        translations: {
                          ...newRestaurant.translations,
                          [activeLang]: { ...newRestaurant.translations?.[activeLang], description: e.target.value }
                        }
                      })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                      rows={3}
                      placeholder={t('restaurants.descriptionPlaceholder')}
                    />
                  </div>
                </div>
              </section>

              {/* Section : Type, catégorie, bateau — Contenuto per lingua */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {getFormLabel(activeLang, 'restaurantTypeLabel')} <span className="text-amber-600">*</span>
                    <span className="text-gray-400 font-normal ml-1">({activeLang})</span>
                  </label>
                  <input
                    type="text"
                    value={newRestaurant.translations?.[activeLang]?.type ?? newRestaurant.type ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNewRestaurant({
                        ...newRestaurant,
                        ...(activeLang === 'fr' ? { type: v } : {}),
                        translations: {
                          ...newRestaurant.translations,
                          [activeLang]: { ...newRestaurant.translations?.[activeLang], type: v }
                        }
                      });
                    }}
                    placeholder={getFormLabel(activeLang, 'selectPlaceholder')}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('restaurants.contentByLanguage')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {getFormLabel(activeLang, 'type')}
                    <span className="text-gray-400 font-normal ml-1">({activeLang})</span>
                  </label>
                  <input
                    type="text"
                    value={newRestaurant.translations?.[activeLang]?.category ?? newRestaurant.category ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNewRestaurant({
                        ...newRestaurant,
                        ...(activeLang === 'fr' ? { category: v } : {}),
                        translations: {
                          ...newRestaurant.translations,
                          [activeLang]: { ...newRestaurant.translations?.[activeLang], category: v }
                        }
                      });
                    }}
                    placeholder={getFormLabel(activeLang, 'selectPlaceholder')}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('restaurants.contentByLanguage')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {getFormLabel(activeLang, 'shipLabel')} <span className="text-amber-600">*</span>
                  </label>
                  <div className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 flex items-center gap-2">
                    <Ship size={18} className="text-slate-500 shrink-0" />
                    {newRestaurant.shipName || boatConfig.shipName || getFormLabel(activeLang, 'selectShipPlaceholder')}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{t('settings.boatConfigSubtitle')}</p>
                </div>
              </section>

              {/* Section : Localisation & horaires */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                    <MapPin size={14} /> {getFormLabel(activeLang, 'locationLabel')}
                  </label>
                  <input
                    type="text"
                    value={newRestaurant.location}
                    onChange={(e) => setNewRestaurant({ ...newRestaurant, location: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder={getFormLabel(activeLang, 'locationPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                    <DollarSign size={14} /> {getFormLabel(activeLang, 'priceRangeLabel')}
                  </label>
                  <select
                    value={newRestaurant.priceRange}
                    onChange={(e) => setNewRestaurant({ ...newRestaurant, priceRange: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="€">{getFormLabel(activeLang, 'priceRangeBudget')}</option>
                    <option value="€€">{getFormLabel(activeLang, 'priceRangeModerate')}</option>
                    <option value="€€€">{getFormLabel(activeLang, 'priceRangeHigh')}</option>
                    <option value="€€€€">{getFormLabel(activeLang, 'priceRangeVeryHigh')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                    <Clock size={14} /> {getFormLabel(activeLang, 'openingHoursLabel')}
                  </label>
                  <input
                    type="text"
                    value={newRestaurant.openingHours}
                    onChange={(e) => setNewRestaurant({ ...newRestaurant, openingHours: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder={getFormLabel(activeLang, 'openingHoursPlaceholder')}
                  />
                </div>
              </section>

              {/* Note (rating) */}
              <section>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                  <Star size={14} className="text-amber-500" /> {t('restaurants.displayedRating')}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    value={newRestaurant.rating}
                    onChange={(e) => setNewRestaurant({ ...newRestaurant, rating: parseFloat(e.target.value) || 4.5 })}
                    className="w-24 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-gray-500 text-sm">/ 5</span>
                </div>
              </section>

              {/* Image du restaurant */}
              <section>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('restaurants.restaurantImage')}</label>
                {imagePreview ? (
                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-36 h-24 rounded-lg overflow-hidden bg-white border border-gray-200 shadow-sm">
                        <img
                          src={imagePreview}
                          alt="Aperçu"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {imageFile?.name || t('restaurants.imageSelected')}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {imageFile ? `${(imageFile.size / 1024).toFixed(1)} KB` : t('restaurants.imageExisting')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={removeImage}
                        className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-amber-50 hover:border-amber-300 transition-colors">
                    <div className="flex flex-col items-center justify-center py-6">
                      <Upload size={36} className="text-gray-400 mb-2" />
                      <p className="mb-1 text-sm font-medium text-gray-600">
                        {t('restaurants.clickOrDrag')}
                      </p>
                      <p className="text-xs text-gray-500">{t('restaurants.imageSpecs')}</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </section>

              {/* Spécialités */}
              <section>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('restaurants.specialtiesLabel')}</label>
                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <Globe size={12} />
                  {t('restaurants.contentByLanguage')} : spécialités en <strong>{LANG_LIST.find(l => l.code === activeLang)?.label ?? activeLang}</strong>
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(newRestaurant.translations?.[activeLang]?.specialties ?? newRestaurant.specialties ?? []).map((specialty, index) => (
                    <span
                      key={`${activeLang}-${index}-${specialty}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-sm font-medium"
                    >
                      {specialty}
                      <button
                        type="button"
                        onClick={() => removeSpecialty(specialty)}
                        className="hover:text-amber-900 p-0.5 rounded"
                        aria-label={t('restaurants.removeSpecialty', { name: specialty })}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSpecialty}
                    onChange={(e) => setNewSpecialty(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSpecialty();
                      }
                    }}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder={t('restaurants.specialtiesPlaceholder')}
                  />
                    <button
                      type="button"
                      onClick={addSpecialty}
                      className="px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-1"
                    >
                    <Plus size={18} />
                    {t('common.add')}
                  </button>
                </div>
              </section>

              {/* Section : Menu */}
              <section className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide flex items-center gap-2 mb-4">
                  <Utensils size={16} className="text-amber-600" />
                  {t('restaurants.menu')}
                </h3>
                {newRestaurant.menu.length > 0 && (
                  <div className="space-y-2 mb-4 max-h-52 overflow-y-auto pr-1">
                    {newRestaurant.menu.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl gap-3 border border-gray-100">
                        <div className="relative w-12 h-12 flex-shrink-0">
                          {item.image ? (
                            <img
                              src={getImageSrc(item.image)}
                              alt={item.name}
                              className="w-12 h-12 object-cover rounded-lg absolute inset-0"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                const placeholder = e.target.nextElementSibling;
                                if (placeholder) placeholder.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center"
                            style={{ display: item.image ? 'none' : 'flex' }}
                          >
                            <Utensils size={20} className="text-amber-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{item.translations?.[activeLang]?.name || item.translations?.fr?.name || item.name}</p>
                          <p className="text-sm text-gray-500">€{item.price}{item.category ? ` · ${MENU_CATEGORY_LABELS[item.category]?.[activeLang] || item.category}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditMenuItem(item)}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            aria-label={t('restaurants.editMenuItem')}
                            title={t('restaurants.editMenuItem')}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeMenuItem(item.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            aria-label={t('restaurants.removeFromMenu')}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Globe size={12} />
                    {t('restaurants.contentByLanguage')} : nom et description du plat en <strong>{LANG_LIST.find(l => l.code === activeLang)?.label ?? activeLang}</strong>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newMenuItem.translations?.[activeLang]?.name ?? ''}
                      onChange={(e) => setNewMenuItem({
                        ...newMenuItem,
                        translations: {
                          ...newMenuItem.translations,
                          [activeLang]: { ...newMenuItem.translations?.[activeLang], name: e.target.value }
                        }
                      })}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder={t('restaurants.dishNamePlaceholder')}
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newMenuItem.price}
                      onChange={(e) => setNewMenuItem({ ...newMenuItem, price: e.target.value })}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder={t('restaurants.pricePlaceholder')}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select
                      value={newMenuItem.category}
                      onChange={(e) => setNewMenuItem({ ...newMenuItem, category: e.target.value })}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {Object.entries(MENU_CATEGORY_LABELS).map(([key]) => (
                        <option key={key} value={key}>{MENU_CATEGORY_LABELS[key][activeLang] || key}</option>
                      ))}
                    </select>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('restaurants.dishImageOptional')}</label>
                      {menuItemImagePreview ? (
                        <div className="flex items-center gap-2">
                          <img src={getImageSrc(menuItemImagePreview) || menuItemImagePreview} alt="Aperçu" className="w-14 h-14 object-cover rounded-lg border border-gray-300" />
                          <button type="button" onClick={removeMenuItemImage} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-2 w-full h-11 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-amber-50 hover:border-amber-300 justify-center transition-colors">
                          <Upload size={18} className="text-gray-500" />
                          <span className="text-xs text-gray-600">{t('restaurants.addImage')}</span>
                          <input type="file" accept="image/*" onChange={handleMenuItemImageUpload} className="hidden" />
                        </label>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={newMenuItem.translations?.[activeLang]?.description ?? ''}
                    onChange={(e) => setNewMenuItem({
                      ...newMenuItem,
                      translations: {
                        ...newMenuItem.translations,
                        [activeLang]: { ...newMenuItem.translations?.[activeLang], description: e.target.value }
                      }
                    })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    rows={2}
                    placeholder={t('restaurants.dishDescriptionPlaceholder')}
                  />
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newMenuItem.isPopular}
                        onChange={(e) => setNewMenuItem({ ...newMenuItem, isPopular: e.target.checked })}
                        className="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500"
                      />
                      <span className="text-sm text-gray-700">{t('restaurants.popularDish')}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      {editingMenuItemId && (
                        <button
                          type="button"
                          onClick={cancelEditMenuItem}
                          className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                        >
                          {t('common.cancel')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={addMenuItem}
                        disabled={uploadingMenuItemImage}
                        className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {editingMenuItemId ? (
                          <>
                            <Pencil size={16} />
                            {t('restaurants.editMenuItem')}
                          </>
                        ) : (
                          <>
                            <Plus size={16} />
                            {uploadingMenuItemImage ? t('shipmap.uploading') : t('restaurants.addToMenu')}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section : Promotions */}
              <section className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide flex items-center gap-2 mb-4">
                  <Award size={16} className="text-orange-500" />
                  {t('restaurants.promotionsLabel')}
                </h3>
                {(newRestaurant.promotions || []).length > 0 && (
                  <div className="space-y-2 mb-4 max-h-44 overflow-y-auto pr-1">
                    {newRestaurant.promotions.map((promo) => (
                      <div key={promo.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-xl gap-3 border border-orange-100">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{promo.translations?.[activeLang]?.title ?? promo.translations?.fr?.title ?? promo.title}</p>
                          <p className="text-sm text-gray-600">
                            {promo.price}€ {promo.originalPrice != null && <span className="line-through text-gray-400">{promo.originalPrice}€</span>}
                            {promo.discount != null && <span className="ml-1 text-orange-600 font-medium">-{promo.discount}%</span>}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePromotion(promo.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          aria-label={t('restaurants.removePromotion')}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-4 p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Globe size={12} />
                    {t('restaurants.contentByLanguage')} : titre et description de la promotion en <strong>{LANG_LIST.find(l => l.code === activeLang)?.label ?? activeLang}</strong>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newPromotion.translations?.[activeLang]?.title ?? ''}
                      onChange={(e) => setNewPromotion({
                        ...newPromotion,
                        translations: {
                          ...newPromotion.translations,
                          [activeLang]: { ...newPromotion.translations?.[activeLang], title: e.target.value }
                        }
                      })}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder={t('restaurants.promotionTitlePlaceholder')}
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newPromotion.price}
                      onChange={(e) => setNewPromotion({ ...newPromotion, price: e.target.value })}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder={t('restaurants.promotionPricePlaceholder')}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newPromotion.originalPrice}
                      onChange={(e) => setNewPromotion({ ...newPromotion, originalPrice: e.target.value })}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder={t('restaurants.originalPricePlaceholder')}
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newPromotion.discount}
                      onChange={(e) => setNewPromotion({ ...newPromotion, discount: e.target.value })}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder={t('restaurants.discountPlaceholder')}
                    />
                  </div>
                  <input
                    type="date"
                    value={newPromotion.validUntil}
                    onChange={(e) => setNewPromotion({ ...newPromotion, validUntil: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder={t('restaurants.validUntilPlaceholder')}
                  />
                  <textarea
                    value={newPromotion.translations?.[activeLang]?.description ?? ''}
                    onChange={(e) => setNewPromotion({
                      ...newPromotion,
                      translations: {
                        ...newPromotion.translations,
                        [activeLang]: { ...newPromotion.translations?.[activeLang], description: e.target.value }
                      }
                    })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    rows={2}
                    placeholder={t('restaurants.promotionDescriptionPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={addPromotion}
                    className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    <Plus size={16} />
                    {t('restaurants.addPromotionButton')}
                  </button>
                </div>
              </section>

              {/* Statut ouvert / fermé */}
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
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50/50">
              <button type="button" onClick={closeModal} className="px-5 py-2.5 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors font-medium">
                {t('common.cancel')}
              </button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={editingId ? handleUpdateRestaurant : handleAddRestaurant}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium shadow-sm"
              >
                <Save size={18} />
                {editingId ? t('restaurants.saveChanges') : t('restaurants.saveRestaurant')}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Restaurants;



