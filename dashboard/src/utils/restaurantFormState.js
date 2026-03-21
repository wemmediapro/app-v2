import { LANG_LIST, emptyMenuTranslations, emptyPromotionTranslations } from './i18n';
import { RESTAURANT_TYPE_LABELS, RESTAURANT_CATEGORY_LABELS } from '../constants/restaurantLabels';

/** Transforme un restaurant API en état formulaire (pour édition) */
export function restaurantToFormState(r) {
  const translations = {};
  LANG_LIST.forEach(({ code }) => {
    const base = r.translations?.[code];
    const fr = r.translations?.fr;
    translations[code] = {
      name: base?.name ?? (code === 'fr' ? (r.name ?? '') : (fr?.name ?? '')),
      description: base?.description ?? (code === 'fr' ? (r.description ?? '') : (fr?.description ?? '')),
      type:
        base?.type ?? (RESTAURANT_TYPE_LABELS[r.type]?.[code] || (code === 'fr' ? r.type : fr?.type || r.type || '')),
      category:
        base?.category ??
        (RESTAURANT_CATEGORY_LABELS[r.category]?.[code] ||
          (code === 'fr' ? (r.category ?? '') : fr?.category || r.category || '')),
      specialties: Array.isArray(base?.specialties)
        ? [...base.specialties]
        : code === 'fr'
          ? Array.isArray(r.specialties)
            ? [...r.specialties]
            : []
          : [],
    };
  });
  const menu = (r.menu || []).map((item, idx) => {
    const menuTranslations = emptyMenuTranslations();
    LANG_LIST.forEach(({ code }) => {
      const menuLang = r.translations?.[code]?.menu;
      const entry = Array.isArray(menuLang) && menuLang[idx] ? menuLang[idx] : null;
      menuTranslations[code] = {
        name: entry && entry.name ? entry.name : (item.name ?? ''),
        description: entry && entry.description ? entry.description : (item.description ?? ''),
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
      translations: menuTranslations,
    };
  });
  const promotions = (r.promotions || []).map((promo, idx) => {
    const promoTranslations = emptyPromotionTranslations();
    LANG_LIST.forEach(({ code }) => {
      const promoLang = r.translations?.[code]?.promotions;
      const entry = Array.isArray(promoLang) && promoLang[idx] ? promoLang[idx] : null;
      promoTranslations[code] = {
        title: entry && entry.title ? entry.title : (promo.title ?? ''),
        description: entry && entry.description ? entry.description : (promo.description ?? ''),
      };
    });
    return {
      ...promo,
      translations:
        promo.translations && typeof promo.translations === 'object'
          ? { ...emptyPromotionTranslations(), ...promo.translations }
          : promoTranslations,
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
    translations,
  };
}
